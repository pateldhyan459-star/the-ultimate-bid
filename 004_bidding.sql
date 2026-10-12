-- =====================================================================
-- THE ULTIMATE BID  |  Migration 004: live bidding (Stage 4) and
-- administrator controls (Stage 5). Run AFTER 003.
--
-- Every rule that matters is enforced HERE, in the database:
--   * the clock is the database clock (clock_timestamp()), not the browser's
--   * place_bid locks the lot row, so simultaneous bids are handled one at a time
--   * budget, minimum increment, room/lot state and team membership are checked
--     inside the same transaction as the insert
-- =====================================================================

alter table public.lots add column paused_remaining_ms integer;

-- Browsers use this only to DISPLAY a countdown. It decides nothing.
create function public.server_now()
returns timestamptz
language sql
volatile
set search_path = ''
as $$ select clock_timestamp(); $$;
revoke all on function public.server_now() from public;
grant execute on function public.server_now() to authenticated;

-- Internal: close a lot that the caller has already locked.
create function public._close_lot(p_lot_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  select * into v_lot from public.lots l where l.id = p_lot_id;
  if v_lot.current_team_id is not null and v_lot.current_bid is not null then
    update public.lots set status = 'sold', paused_remaining_ms = null where id = v_lot.id;
    insert into public.purchases (room_id, lot_id, team_id, price)
    values (v_lot.room_id, v_lot.id, v_lot.current_team_id, v_lot.current_bid)
    on conflict (lot_id) do nothing;
  else
    update public.lots set status = 'unsold', paused_remaining_ms = null where id = v_lot.id;
  end if;
end;
$$;
revoke all on function public._close_lot(uuid) from public, anon, authenticated;

-- Anyone in the room (or an admin) may call this once the timer has run out.
-- Nothing runs on a schedule, so each open browser asks when its countdown hits
-- zero. It is safe to call many times: only the first call changes anything.
create function public.finalize_lot(p_lot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  select * into v_lot from public.lots l where l.id = p_lot_id for update;
  if not found then
    raise exception 'Lot not found';
  end if;
  if not (public.is_admin() or public.is_room_member(v_lot.room_id)) then
    raise exception 'Not authorised';
  end if;
  if v_lot.status = 'live' and v_lot.ends_at is not null and clock_timestamp() >= v_lot.ends_at then
    perform public._close_lot(v_lot.id);
  end if;
  return (select to_jsonb(l) from public.lots l where l.id = p_lot_id);
end;
$$;
revoke all on function public.finalize_lot(uuid) from public, anon;
grant execute on function public.finalize_lot(uuid) to authenticated;

create function public.place_bid(p_lot_id uuid, p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lot public.lots;
  v_room public.rooms;
  v_part public.participants;
  v_team public.teams;
  v_incr bigint;
  v_min bigint;
  v_spent bigint;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  -- Lock the lot: concurrent bids on it queue up here, one at a time.
  select * into v_lot from public.lots l where l.id = p_lot_id for update;
  if not found then
    raise exception 'Lot not found';
  end if;

  select * into v_part from public.participants p
    where p.room_id = v_lot.room_id and p.user_id = v_uid and p.status = 'approved';
  if not found or v_part.team_id is null then
    raise exception 'You are not an approved participant of this room.';
  end if;

  select * into v_room from public.rooms r where r.id = v_lot.room_id;
  if v_room.status <> 'live' then
    raise exception 'The auction is not live right now.';
  end if;
  if v_lot.status <> 'live' or v_lot.ends_at is null then
    raise exception 'This lot is not open for bidding.';
  end if;
  if clock_timestamp() >= v_lot.ends_at then
    raise exception 'Time is up for this lot.';
  end if;
  if v_lot.current_team_id = v_part.team_id then
    raise exception 'Your team already holds the highest bid.';
  end if;

  v_incr := coalesce(v_lot.min_increment, v_room.min_increment);
  v_min := case when v_lot.current_bid is null then v_lot.base_price else v_lot.current_bid + v_incr end;
  if p_amount is null or p_amount < v_min then
    raise exception 'The minimum bid is % credits.', v_min;
  end if;

  select * into v_team from public.teams t where t.id = v_part.team_id;
  select coalesce(sum(pu.price), 0) into v_spent from public.purchases pu where pu.team_id = v_team.id;
  if p_amount > v_team.budget - v_spent then
    raise exception 'Not enough budget. Your team has % credits left.', v_team.budget - v_spent;
  end if;

  insert into public.bids (room_id, lot_id, team_id, participant_id, amount)
  values (v_lot.room_id, v_lot.id, v_team.id, v_part.id, p_amount);
  update public.lots set current_bid = p_amount, current_team_id = v_team.id where id = v_lot.id;

  return jsonb_build_object('lot_id', v_lot.id, 'amount', p_amount, 'team_id', v_team.id);
end;
$$;
revoke all on function public.place_bid(uuid, bigint) from public, anon;
grant execute on function public.place_bid(uuid, bigint) to authenticated;

-- ---------------- Administrator controls ----------------

create function public.admin_start_lot(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
  v_room public.rooms;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  select * into v_lot from public.lots l where l.id = p_lot_id for update;
  if not found then raise exception 'Lot not found'; end if;
  select * into v_room from public.rooms r where r.id = v_lot.room_id for update;
  if v_room.status <> 'live' then
    raise exception 'Set the room to Live before starting a lot.';
  end if;
  if v_lot.status <> 'upcoming' then
    raise exception 'Only an upcoming lot can be started.';
  end if;
  if exists (select 1 from public.lots l where l.room_id = v_lot.room_id and l.status in ('live', 'paused')) then
    raise exception 'Another lot is already running. End it first.';
  end if;
  update public.lots
    set status = 'live', current_bid = null, current_team_id = null, paused_remaining_ms = null,
        ends_at = clock_timestamp() + make_interval(secs => v_room.timer_seconds)
    where id = v_lot.id;
end;
$$;

create function public.admin_pause_lot(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  select * into v_lot from public.lots l where l.id = p_lot_id for update;
  if not found or v_lot.status <> 'live' then raise exception 'Only a live lot can be paused.'; end if;
  update public.lots
    set status = 'paused',
        paused_remaining_ms = greatest(0, floor(extract(epoch from (v_lot.ends_at - clock_timestamp())) * 1000))::integer,
        ends_at = null
    where id = v_lot.id;
end;
$$;

create function public.admin_resume_lot(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
  v_room public.rooms;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  select * into v_lot from public.lots l where l.id = p_lot_id for update;
  if not found or v_lot.status <> 'paused' then raise exception 'Only a paused lot can be resumed.'; end if;
  select * into v_room from public.rooms r where r.id = v_lot.room_id;
  if v_room.status <> 'live' then raise exception 'Set the room to Live first.'; end if;
  update public.lots
    set status = 'live',
        ends_at = clock_timestamp() + make_interval(secs => coalesce(v_lot.paused_remaining_ms, 0) / 1000.0),
        paused_remaining_ms = null
    where id = v_lot.id;
end;
$$;

-- End a live or paused lot right now (sold to the top bidder, or unsold if no bids).
create function public.admin_end_lot(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  select * into v_lot from public.lots l where l.id = p_lot_id for update;
  if not found or v_lot.status not in ('live', 'paused') then
    raise exception 'Only a live or paused lot can be ended.';
  end if;
  perform public._close_lot(v_lot.id);
end;
$$;

-- Room state: lobby, live, paused, ended. Pausing the room pauses the running lot.
-- Ending the room closes any running lot. Resuming the room does NOT restart the
-- lot clock: press Resume on the lot.
create function public.admin_set_room_status(p_room_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_lot public.lots;
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  if p_status not in ('lobby', 'live', 'paused', 'ended') then raise exception 'Invalid status'; end if;
  select * into v_room from public.rooms r where r.id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.status = 'ended' then raise exception 'This auction has ended and cannot be reopened.'; end if;

  for v_lot in select * from public.lots l where l.room_id = p_room_id and l.status in ('live', 'paused') for update loop
    if p_status = 'ended' then
      perform public._close_lot(v_lot.id);
    elsif p_status in ('paused', 'lobby') and v_lot.status = 'live' then
      update public.lots
        set status = 'paused',
            paused_remaining_ms = greatest(0, floor(extract(epoch from (v_lot.ends_at - clock_timestamp())) * 1000))::integer,
            ends_at = null
        where id = v_lot.id;
    end if;
  end loop;
  update public.rooms set status = p_status where id = p_room_id;
end;
$$;

revoke all on function
  public.admin_start_lot(uuid), public.admin_pause_lot(uuid), public.admin_resume_lot(uuid),
  public.admin_end_lot(uuid), public.admin_set_room_status(uuid, text)
  from public, anon;
grant execute on function
  public.admin_start_lot(uuid), public.admin_pause_lot(uuid), public.admin_resume_lot(uuid),
  public.admin_end_lot(uuid), public.admin_set_room_status(uuid, text)
  to authenticated;

-- ---------------- Realtime ----------------
-- Realtime respects the Row Level Security policies from migration 002, so a
-- player only receives changes for rows they are allowed to read.
alter publication supabase_realtime add table
  public.rooms, public.lots, public.bids, public.purchases, public.participants, public.teams;
