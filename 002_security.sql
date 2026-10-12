-- =====================================================================
-- THE ULTIMATE BID  |  Migration 002: security (Row Level Security)
-- Run this SECOND, after 001_schema.sql succeeded.
--
-- Principle: default deny. Row Level Security (RLS) is switched on for every
-- table, and a table only allows what a policy below explicitly permits.
--   * Administrators (listed in public.admins) can read and write everything.
--   * Participants can only READ data for rooms they belong to.
--   * Nobody except admins can write to any table directly. Joining a room and
--     placing bids will go through server-side database functions that arrive
--     in Stages 3 and 4, which is where budget and timer checks are enforced.
-- =====================================================================

-- ---------- Helper functions ----------
-- SECURITY DEFINER lets these read the admins/participants tables even though
-- the caller cannot, and it avoids policies calling each other in a loop.
-- search_path is pinned to empty so the functions cannot be hijacked.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

-- Is the caller an APPROVED participant of this room?
create function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants p
    where p.room_id = p_room_id
      and p.user_id = (select auth.uid())
      and p.status = 'approved'
  );
$$;

-- Only signed-in users may call the helpers; anonymous web visitors may not.
revoke all on function public.is_admin()              from public, anon;
revoke all on function public.is_room_member(uuid)    from public, anon;
grant execute on function public.is_admin()           to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;

-- ---------- Switch RLS on everywhere ----------
alter table public.admins       enable row level security;
alter table public.rooms        enable row level security;
alter table public.teams        enable row level security;
alter table public.participants enable row level security;
alter table public.lots         enable row level security;
alter table public.bids         enable row level security;
alter table public.purchases    enable row level security;

-- ---------- Table privileges (second layer of defence) ----------
-- Visitors who are not signed in get nothing at all.
revoke all on public.admins, public.rooms, public.teams, public.participants,
              public.lots, public.bids, public.purchases from anon;
-- Signed-in users get the privileges RLS then filters.
revoke all on public.admins from authenticated;
grant select on public.admins to authenticated;  -- policy limits it to their own row
grant select, insert, update, delete on
  public.rooms, public.teams, public.participants, public.lots,
  public.bids, public.purchases to authenticated;

-- ---------- admins ----------
-- You can see only your own row. Nobody can insert/update/delete from the browser.
create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- rooms ----------
create policy rooms_admin_all on public.rooms
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rooms_member_select on public.rooms
  for select to authenticated
  using (public.is_room_member(id));

-- ---------- teams ----------
create policy teams_admin_all on public.teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy teams_member_select on public.teams
  for select to authenticated
  using (public.is_room_member(room_id));

-- ---------- participants ----------
create policy participants_admin_all on public.participants
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A participant sees only their own row (including while still 'pending').
create policy participants_select_own on public.participants
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- lots ----------
create policy lots_admin_all on public.lots
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lots_member_select on public.lots
  for select to authenticated
  using (public.is_room_member(room_id));

-- ---------- bids (read only for members; written only by place_bid in Stage 4) ----------
create policy bids_admin_all on public.bids
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy bids_member_select on public.bids
  for select to authenticated
  using (public.is_room_member(room_id));

-- ---------- purchases ----------
create policy purchases_admin_all on public.purchases
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy purchases_member_select on public.purchases
  for select to authenticated
  using (public.is_room_member(room_id));
