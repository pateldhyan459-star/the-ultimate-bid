-- =====================================================================
-- Make YOUR account an administrator.
-- This is NOT a migration. Run it by hand, once, after:
--   1. migrations 001 and 002 have succeeded, and
--   2. you created your user in Supabase -> Authentication -> Users.
--
-- Replace the email below with the EXACT email of that user, keeping the quotes.
-- =====================================================================
insert into public.admins (user_id, email)
select id, email
from auth.users
where email = 'REPLACE_WITH_YOUR_EMAIL@example.com'
on conflict (user_id) do nothing;

-- Check it worked: this should return exactly ONE row with your email.
select user_id, email, created_at from public.admins;
