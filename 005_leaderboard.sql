-- =====================================================================
-- THE ULTIMATE BID  |  Migration 005: leaderboard (Stage 6). Run AFTER 004.
-- Ranking rule (an assumption you can change): most lots won first, then most
-- budget remaining, then team name.
-- =====================================================================
create function public.room_leaderboard(p_room_id uuid)
returns table (
  team_id uuid,
  team_name text,
  budget bigint,
  spent bigint,
  remaining bigint,
  lots_won bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         t.name,
         t.budget,
         coalesce(sum(p.price), 0)::bigint,
         (t.budget - coalesce(sum(p.price), 0))::bigint,
         count(p.id)
  from public.teams t
  left join public.purchases p on p.team_id = t.id
  where t.room_id = p_room_id
    and (public.is_admin() or public.is_room_member(p_room_id))
  group by t.id
  order by count(p.id) desc, (t.budget - coalesce(sum(p.price), 0)) desc, t.name;
$$;
revoke all on function public.room_leaderboard(uuid) from public, anon;
grant execute on function public.room_leaderboard(uuid) to authenticated;
