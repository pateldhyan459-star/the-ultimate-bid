# Stage 2 setup guide (Windows, beginner)

Do the parts in order. Total time: about 20 minutes.

## Part A. Create a Supabase project

1. Go to https://supabase.com and click **Start your project**. Sign up (GitHub or email).
2. Click **New project**. Choose your organisation.
3. **Name:** `the-ultimate-bid`.
4. **Database password:** click **Generate a password**, then **copy it into a password manager or a notes file**. You rarely need it, but you cannot read it again later.
5. **Region:** pick the one closest to your players (for India, a Mumbai or Singapore region if listed).
6. Click **Create new project** and wait 1-2 minutes until the dashboard loads.

## Part B. Copy the two browser settings

1. Left sidebar: **Project Settings** (gear icon) -> **API** (or **API Keys**).
2. Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
3. Copy the **anon public** key (a long text starting `eyJ...`). Newer dashboards may label it **publishable** (`sb_publishable_...`); use that if it is what you see.
4. **Do NOT copy** the `service_role` or `secret` key. It is never used in this project.

## Part C. Put them in your project

1. Open the `the-ultimate-bid` folder in File Explorer.
2. Find `.env.example`. Copy it and rename the copy to exactly `.env`.
   (If Windows hides extensions: View -> Show -> File name extensions. The file name is `.env`, nothing after it. In Notepad use Save As -> "All files" if needed.)
3. Open `.env` in Notepad and fill in:
   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your long key...
   ```
   No quotes, no spaces around `=`.
4. Save and close.

## Part D. Create the database tables

1. Supabase dashboard -> **SQL Editor** (left sidebar) -> **New query**.
2. Open `supabase/migrations/001_schema.sql` in Notepad, select all (Ctrl+A), copy (Ctrl+C).
3. Paste into the SQL Editor and click **Run**. Expected: "Success. No rows returned".
4. Click **New query** again. Do the same with `supabase/migrations/002_security.sql`. Expected: success again.
5. If either shows a red error, **stop**, copy the full message and send it to me. Do not run the file a second time.

## Part E. Create your administrator account

1. Left sidebar: **Authentication** -> **Users** -> **Add user** -> **Create new user**.
2. Enter your email and a strong password (12+ characters, unique to this site).
3. **Tick "Auto Confirm User"**, then **Create user**.
4. SQL Editor -> **New query**. Open `supabase/manual/add_admin.sql`, replace `REPLACE_WITH_YOUR_EMAIL@example.com` with your exact email (keep the quotes), copy, paste, **Run**.
5. The result at the bottom must show **one row** with your email. Zero rows means the email did not match exactly.

## Part F. Recommended dashboard settings

- **Authentication -> Sign In / Providers** (the label varies by dashboard version): you only need the **Email** provider. If there is a switch **Allow new users to sign up**, you may turn it OFF for now, because participants cannot join until Stage 3. **Tell me if you turn it off:** Stage 3 uses anonymous sign-ins for participants and I will give you the exact settings then. I have not verified how that switch interacts with anonymous sign-ins, so I will confirm it before Stage 3.
- Do not enable any other providers.

## Part G. Run the site

1. Open **Command Prompt**: press Windows key, type `cmd`, Enter.
2. Go to your folder (change the path to yours):
   ```
   cd C:\Users\YourName\Downloads\the-ultimate-bid
   ```
3. Install the new files: `npm install` (needed because you are using a fresh copy).
4. Start: `npm run dev`
5. Open http://localhost:5173/admin/login

## Part H. Tests to do and report back

Please try each and tell me the exact result:

1. The grey "Preview mode" bar is replaced by "Backend settings found".
2. Sign in with your admin email and password. Expected: you land on **Organiser dashboard** with "Database reachable. Rooms visible to you: 0".
3. Click **Sign out**. Expected: you can still see the home page; visiting `/admin` sends you to the login page.
4. Wrong password. Expected: "Incorrect email or password."
5. Security check: in Supabase create a second user (Authentication -> Users -> Add user) with a different email, do **not** add it to admins, and try to sign in on the site. Expected: "Incorrect email or password." (it is refused because it is not on the allow-list).
6. SQL Editor: run `supabase/manual/verify_security.sql`. Expected: every table has `rls_enabled = true`, and no policy lists role `anon`.
7. Optional: run `supabase/seed.sql`, refresh the dashboard. Expected: "Rooms visible to you: 1".

## Troubleshooting

| What you see | Likely cause |
| --- | --- |
| Still "Preview mode" | `.env` is misnamed (e.g. `.env.txt`), or you did not restart `npm run dev` |
| "Incorrect email or password" for your real admin | Wrong password, user not auto-confirmed, or `add_admin.sql` returned 0 rows |
| "Database check failed ... relation does not exist" | Migrations not run, or run in the wrong order |
| `npm install` 403 error | Network/registry policy; try a different network and report the message |
