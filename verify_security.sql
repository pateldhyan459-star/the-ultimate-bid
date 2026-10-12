-- =====================================================================
-- Read-only checks. Paste into the SQL Editor and press Run.
-- Result 1: every table should show rls_enabled = true.
-- Result 2: lists every policy; there must be NO policy for role "anon".
-- Result 3: should list exactly the admins you intended.
-- =====================================================================
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select user_id, email from public.admins;
