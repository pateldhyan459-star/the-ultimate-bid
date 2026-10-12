# Deployment and event day (Stage 11)

**Status: written, not run by me.** I could not deploy from my environment. Dashboards change, so button names below may differ slightly.

## Before you deploy: three limits that affect a school event

These come from Supabase's own documentation (checked when writing; confirm on their pricing and limits pages before the event).

1. **Anonymous sign-ins are limited to 30 per hour per IP address.** At a venue, all players usually share one public IP, so only about 30 players could join in an hour. **Fix:** Supabase dashboard -> Authentication -> **Rate Limits**, raise the anonymous sign-in limit (the label may differ), or upgrade the plan. Test this at the dress rehearsal with more than 30 phones. If you cannot raise it, tell me and I will change the design (for example, players on mobile data do not share an IP).
2. **Free plan Realtime: 200 concurrent connections and 100 messages per second.** Each open player screen uses one connection, plus your admin pages and projector. Plan for **at most about 150 players** on free. Above that, upgrade for the event (Pro raises it to 500 per the same docs). I reduced traffic in this version (players subscribe to fewer tables, refresh slowly with random delay), but have not measured it.
3. **Free projects pause after about a week of no use,** and free projects have no downloadable backups. Open the site and sign in the day before; download the results CSV after each event.

## Part A. Final checks in your project

1. `npm run typecheck` shows no errors.
2. Search for accidental secrets. In Command Prompt in the project folder:
   ```
   findstr /s /i /m "service_role" src
   ```
   Expected: no files listed. The `.env` file must only contain the Project URL and the anon/publishable key.
3. Supabase -> Table Editor -> `admins`: only **your** row.
4. Delete test rooms and the DEMO room (`DEMK23`) from the dashboard.
5. Change your admin password to a strong unique one (Authentication -> Users -> your user), if it was ever typed on a shared computer.

## Part B. Build

1. Make sure `.env` has your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, plus the optional event details (organiser name, date, venue, contact).
2. Run:
   ```
   npm run build
   ```
   It creates a `dist` folder. These values are baked in at build time, so **rebuild after changing `.env`**.

## Part C. Put it online (pick one)

**Option 1: Netlify drag and drop (simplest, no GitHub).**
1. Create a free account at https://www.netlify.com.
2. Find the manual deploy option ("Add new site" -> "Deploy manually", or Netlify Drop) and drag the **`dist`** folder (not the whole project) into it.
3. Netlify gives you an address like `https://something.netlify.app`. You can rename it in Site settings.

The file `public/_redirects` is already included so links like `/r/ABC234` work when opened directly.

**Option 2: Vercel or Cloudflare Pages from GitHub.** Push the project (the `.gitignore` already excludes `.env`), import it, set build command `npm run build`, output folder `dist`, and add the two `VITE_` environment variables in their settings. `vercel.json` is included for Vercel.

## Part D. After deploying

1. Supabase -> Authentication -> **URL Configuration**: set **Site URL** to your deployed address. (Password sign-in does not depend on it, but set it anyway.)
2. Open your site. Open `https://YOUR-SITE/r/ABC234` directly in the address bar and **refresh**. Expected: the join page, not a "page not found". If you get 404, the redirect file was not applied; tell me which host you used.
3. Sign in at `/admin/login` on the deployed site.
4. Run **Part A of `docs/TESTING_STAGE10.md`** again (the script uses your Supabase project, which is the same one the live site uses).
5. Do the phone test from a different network (mobile data).

## Part E. Event-day runbook

**The day before:** open the site and sign in; build and deploy the final version; create the room; add all lots; print or copy the code and link; test on a phone. Do not change code after this.

**One hour before:** sign in, confirm the room is in **lobby**, open the projector view on the display laptop, test one fake lot then **Reset** it (or use a separate throwaway room and delete it). Connect a spare device or hotspot in case venue Wi-Fi fails.

**Opening:** show the code and link on the projector. Players join; **Approve all** (check names; Remove any unwanted). When ready: **Go live**, **Start** lot 1.

**During:** after each lot sells, Start the next. If something looks wrong, **Pause auction**, fix, go live, **Resume** the lot. Wrong sale? **Reset** the lot (before ending the auction) and run it again.

**Closing:** **End auction**, then **Download results (CSV)** and keep it. Players see the final results.

**If a player's phone dies:** they reopen the link in the same browser; they are still approved. A new browser or incognito window is a new identity and needs approval again.

**If the internet drops for you (admin):** the running timer continues on the server; reconnect and press End now or Pause as needed.

## Known limits (honest list)

- Not load-tested beyond my script's 8 fake players; Part C of the testing guide is how you learn the real capacity.
- No CAPTCHA on guest joins; anyone with the link can request to join (you approve each).
- Lots close when an open browser notices the deadline, not by a background job.
- Ranking is lots won, then budget remaining (my assumption).
- No audit log of admin actions, no multi-admin roles.
