# Testing guide (Stage 10)

**Status of this guide: written, not run by me.** Nothing below counts as "tested" until you run it and see the result yourself.

## Step 0. Run the new migration and update the site

1. Supabase -> SQL Editor -> New query -> paste `supabase/migrations/006_admin_extras.sql` -> **Run** (once).
2. In Command Prompt inside the project folder: `npm install` (only if you are in a fresh folder), then `npm run typecheck`, then `npm run dev`.
3. If `typecheck` prints errors, send them to me before continuing. This round of code has never been type-checked.

## Part A. Automated multi-player test (one command)

This script creates a throwaway room, 8 fake guest players, and checks the rules automatically (simultaneous bids, minimum bid, budget, permissions, server timer). It deletes the room afterwards. It takes about 30 seconds.

Requirements: **Node 22 or newer** (`node --version`). If you have 20, install the LTS version from https://nodejs.org.

In Command Prompt, inside the project folder (replace with your real admin email/password; these stay in this window only and are not saved to any file):

```
set ADMIN_EMAIL=you@example.com
set ADMIN_PASSWORD=your-admin-password
npm run loadtest
```

Expected: a list of `PASS` lines, ending with `N passed, 0 failed`. Send me the **whole output**, especially any `FAIL` line.

Notes:
- Each fake player is a guest sign-in from your IP. Supabase's documented limit is 30 anonymous sign-ins per hour per IP, so do not run it many times in an hour (it needs 9 per run).
- Test guests stay in Authentication -> Users. After testing, remove old guests (only when no real auction is running):
  ```sql
  delete from auth.users where is_anonymous is true and created_at < now() - interval '1 hour';
  ```
  This also removes their participant rows.
- If it fails with a WebSocket error, your Node is too old.

## Part B. Manual test with real devices (about 30 minutes)

Use at least: your admin browser, one incognito window, one different browser (or your phone) = 3 separate identities. Follow the 14 tests in `docs/SETUP_STAGES_3_TO_6.md` Part E, plus these new ones:

1. **Projector view:** in the room page click **Open projector view**. Expected: full-screen display with join code, current lot, bid and clock. Run a lot; it updates.
2. **Reset lot:** on a sold lot click **Reset**. Expected: lot returns to upcoming and the winner's remaining budget is restored.
3. **Edit lot:** on an upcoming lot, **Edit** changes name and opening bid.
4. **Rename room / change rules:** Room rules -> Save rules.
5. **Delete room:** create a throwaway room, add a lot, delete it. Expected: returns to dashboard.
6. **Phone:** open the invite link on a phone on mobile data. Expected: layout fits, bid button is easy to tap, countdown readable.
7. **Reconnect:** on a phone, turn on airplane mode for 20 seconds during a live lot, turn it off. Expected: screen catches up within about 15 seconds.

## Part C. Dress rehearsal (strongly recommended)

At the venue, or at least on the same kind of network, with 10 to 20 real people on their own phones, run a full 5-lot auction using fictional lots. Write down: how many joined, any errors shown, how long updates took. This is the only test that tells you about your real Wi-Fi.

## What "ready" means

You are ready for the event when:
- Part A shows 0 failed, on the deployed environment's Supabase project.
- Part B passes on at least 3 identities, including a phone.
- Part C ran without a stuck or confusing moment.
