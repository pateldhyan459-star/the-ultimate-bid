-- =====================================================================
-- OPTIONAL fictional demo data. Run only AFTER add_admin.sql.
-- Everything here is made up and clearly labelled "DEMO". Delete the room
-- later with:  delete from public.rooms where code = 'DEMK23';
-- (its teams and lots are removed automatically)
-- =====================================================================
with admin_user as (
  select user_id from public.admins order by created_at limit 1
), new_room as (
  insert into public.rooms (code, name, status, created_by)
  select 'DEMK23', 'DEMO room (fictional sample data)', 'draft', user_id
  from admin_user
  on conflict (code) do nothing
  returning id
), t as (
  insert into public.teams (room_id, name, budget)
  select id, team_name, 1000000
  from new_room, (values ('Demo Team Alpha'), ('Demo Team Beta')) as v(team_name)
  returning id
)
insert into public.lots (room_id, position, name, description, category, base_price)
select id, v.pos, v.lot_name, 'Fictional sample lot.', 'Demo', v.price
from new_room,
     (values (1, 'Demo Lot One', 50000), (2, 'Demo Lot Two', 75000), (3, 'Demo Lot Three', 100000))
     as v(pos, lot_name, price);

select code, name, status from public.rooms;
