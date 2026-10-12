-- =====================================================================
-- THE ULTIMATE BID  |  Migration 006: re-auction a lot. Run AFTER 005.
-- Lets the organiser put a sold or unsold lot back to "upcoming" (for a
-- mistake, or to re-run an unsold lot). Its bids and sale are erased, so the
-- winning team gets its budget back. Not allowed once the auction has ended.
-- =====================================================================
create function public.admin_reset_lot(p_lot_id uuid)
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
  select * into v_room from public.rooms r where r.id = v_lot.room_id;
  if v_room.status = 'ended' then raise exception 'The auction has ended; results are final.'; end if;
  if v_lot.status not in ('sold', 'unsold') then
    raise exception 'Only a sold or unsold lot can be reset.';
  end if;
  delete from public.purchases where lot_id = v_lot.id;
  delete from public.bids where lot_id = v_lot.id;
  update public.lots
    set status = 'upcoming', current_bid = null, current_team_id = null,
        ends_at = null, paused_remaining_ms = null
    where id = v_lot.id;
end;
$$;
revoke all on function public.admin_reset_lot(uuid) from public, anon;
grant execute on function public.admin_reset_lot(uuid) to authenticated;
