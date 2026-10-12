-- =====================================================================
-- THE ULTIMATE BID  |  Migration 003: rooms and joining (Stage 3)
-- Run AFTER 001 and 002. Needs "Allow anonymous sign-ins" switched ON
-- (see docs/SETUP_STAGES_3_TO_6.md).
-- =====================================================================

-- Random 6-character code using the same alphabet as src/config/event.ts.
-- Internal helper: not callable from the browser.
create function public.generate_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.rooms r where r.code = candidate);
  end loop;
  return candidate;
end;
$$;
revoke all on function public.generate_room_code() from public, anon, authenticated;

-- Admin only: create a room with a fresh code. Starts in 'lobby' so players can join.
create function public.admin_create_room(
  p_name text,
  p_budget bigint,
  p_increment bigint,
  p_timer integer
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  insert into public.rooms (code, name, status, default_budget, min_increment, timer_seconds, created_by)
  values (public.generate_room_code(), btrim(p_name), 'lobby', p_budget, p_increment, p_timer, (select auth.uid()))
  returning * into r;
  return r;
end;
$$;
revoke all on function public.admin_create_room(text, bigint, bigint, integer) from public, anon;
grant execute on function public.admin_create_room(text, bigint, bigint, integer) to authenticated;

-- Player: join a room by code. The caller must be signed in (anonymous is fine).
-- Creates the team on first use (with the room's default budget); teammates who
-- type the same team name (ignoring case) share that team. Status starts 'pending'.
create function public.join_room(p_code text, p_display_name text, p_team_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.rooms;
  v_part public.participants;
  v_team public.teams;
  v_name text := btrim(p_display_name);
  v_team_name text := btrim(p_team_name);
begin
  if v_uid is null then
    raise exception 'Please reload the page and try again.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'Display name must be 2 to 40 characters.';
  end if;
  if char_length(v_team_name) < 2 or char_length(v_team_name) > 40 then
    raise exception 'Team name must be 2 to 40 characters.';
  end if;

  select * into v_room from public.rooms r where r.code = upper(btrim(p_code));
  if not found then
    raise exception 'No room found with that code.';
  end if;
  if v_room.status = 'ended' then
    raise exception 'This auction has ended.';
  end if;

  select * into v_part from public.participants p where p.room_id = v_room.id and p.user_id = v_uid;
  if found then
    if v_part.status = 'removed' then
      raise exception 'The organiser has removed you from this room.';
    end if;
  else
    if (select count(*) from public.participants p where p.room_id = v_room.id) >= 500 then
      raise exception 'This room is full.';
    end if;
    insert into public.teams (room_id, name, budget)
    values (v_room.id, v_team_name, v_room.default_budget)
    on conflict (room_id, (lower(name))) do nothing;
    select * into v_team from public.teams t
      where t.room_id = v_room.id and lower(t.name) = lower(v_team_name);
    insert into public.participants (room_id, team_id, user_id, display_name)
    values (v_room.id, v_team.id, v_uid, v_name)
    returning * into v_part;
  end if;

  return public.my_join_status(v_room.code);
end;
$$;
revoke all on function public.join_room(text, text, text) from public, anon;
grant execute on function public.join_room(text, text, text) to authenticated;

-- Player: where do I stand in this room? Returns null if I never joined.
create function public.my_join_status(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'room_id', r.id,
    'room_code', r.code,
    'room_name', r.name,
    'room_status', r.status,
    'participant_status', p.status,
    'display_name', p.display_name,
    'team_id', p.team_id,
    'team_name', t.name
  )
  from public.participants p
  join public.rooms r on r.id = p.room_id
  left join public.teams t on t.id = p.team_id
  where r.code = upper(btrim(p_code))
    and p.user_id = (select auth.uid());
$$;
revoke all on function public.my_join_status(text) from public, anon;
grant execute on function public.my_join_status(text) to authenticated;
