# Setup guide: Stages 3 to 6 (rooms, bidding, admin, results)

**Status: written but NOT tested.** I could not install packages or run a database when writing this. Do the tests at the bottom and send me exact errors.

Do Stage 2 first (`docs/SETUP_STAGE2.md`) and confirm you can sign in on `/admin/login`.

## Part A. Switch on guest sessions for players

Players do not create accounts. Supabase gives each browser a private "anonymous" identity.

1. Supabase dashboard -> **Authentication** -> **Sign In / Providers** (name varies by version).
2. Find **Allow anonymous sign-ins** and turn it **ON**. Save.
3. Leave **Allow new users to sign up** ON. I could not confirm whether turning it off also blocks anonymous guests. If you want it off, do the Join test below straight after and turn it back on if joining fails with a "signups not allowed" style message.

Why this is safe: guests are not administrators. Every admin action checks the `admins` table inside the database.

## Part B. Run three more SQL files

For each file: **SQL Editor -> New query**, open the file in Notepad, Ctrl+A, Ctrl+C, paste, **Run**. Run them **once each, in this order**:

1. `supabase/migrations/003_rooms_and_joining.sql`
2. `supabase/migrations/004_bidding.sql`
3. `supabase/migrations/005_leaderboard.sql`

Each should say "Success". If one shows a red error, stop and send me the full text. Do not re-run a file that partly succeeded; tell me first.

## Part C. Run the site

Stop the old server (Ctrl+C in Command Prompt), then `npm run dev` again. No new packages are needed. Open http://localhost:5173/admin/login and sign in.

## Part D. How to run an auction

1. **Dashboard -> Create a room.** Choose budget per team, minimum increment, seconds per lot. You land on the room page.
2. Add lots (name, opening bid). Use fictional items.
3. Click **Copy invite link** or **Copy code** and share it.
4. Players open the link, enter a display name and team name, and wait. In **Participants**, click **Approve** (or **Approve all**).
5. Click **Go live**, then **Start** on a lot. The clock starts on the server.
6. When the timer ends the lot is sold to the highest bidder (or marked unsold). Start the next lot.
7. **End auction** to freeze results. Players then see the final leaderboard and purchases. **Download results (CSV)** saves them.

Rules enforced by the database: only approved players bid; room must be Live and the lot running; bid must be at least opening bid (first bid) or current bid + increment; bid cannot exceed the team's remaining budget; a team cannot outbid itself; one lot runs at a time per room.

## Part E. Tests to do (and report)

**Important:** players must use a **separate browser identity**. Tabs in the same normal browser share one identity (and an admin session would join as the admin). Use a **private/incognito window** for player 1, a **different browser** (e.g. Edge vs Chrome) or your phone for player 2.

1. Create a room. Expected: code with 6 characters, shown on the room page.
2. Incognito: open the invite link, join as "Asha" / team "Red". Expected: "Waiting for approval".
3. Admin: approve. Expected: the player page switches to the room by itself within a few seconds.
4. Admin: Go live, Start a lot. Expected: both screens show a countdown.
5. Player: bid below the minimum. Expected: red message "The minimum bid is ...".
6. Player: bid more than the team budget. Expected: "Not enough budget...".
7. Valid bid. Expected: admin Activity and leaderboard-side lot update without refreshing (note whether it was instant or took up to 5 s).
8. Second player (other browser) joins team "Blue", is approved, outbids. Expected: Red can bid again, Blue cannot bid twice in a row.
9. Let the timer reach zero. Expected: lot becomes **sold**, winner's remaining budget drops, leaderboard updates.
10. Refresh a player page mid-lot. Expected: state and countdown come back.
11. Pause the auction mid-lot, go live, Resume the lot. Expected: remaining time is preserved.
12. Both players press **Bid minimum** at the same instant. Expected: exactly one succeeds, the other gets a minimum-bid or "already holds" error.
13. End auction. Expected: both screens show final results; CSV downloads and opens in Excel.
14. Close the incognito window, open the invite link as a new guest. Expected: you can join but cannot see other rooms' data.

## Known limits and assumptions (please read)

- **Timer expiry is triggered by open browsers.** There is no background job. When a countdown hits zero, each connected browser asks the server to close the lot. The server only closes it if the deadline has truly passed, and only once. If nobody has the page open, the lot closes the next time anyone opens the room or you press End now.
- **Ranking rule is my assumption:** most lots won, then most budget remaining. Tell me if your event ranks differently (e.g. by total value of players bought).
- **Join spam:** anyone with a room code can create pending guests (capped at 500 per room). You can Remove them. No CAPTCHA or rate limiting yet.
- **Room codes are 6 characters from 31 symbols** (about 887 million combinations). Fine for an event, not a secret.
- **Removing a player** blocks them from rejoining that room with the same browser identity; a new incognito window would be a new identity and need approval again.
- **Realtime** is enabled by migration 004. If live updates seem slow, the page still refreshes itself every 5 seconds.
- **Team budgets** are copied from the room default when a team is first created. Changing the default later only affects new teams; edit existing teams in "Teams and budgets".
- **Free tier limits** (connections, database size) are not verified here. Check Supabase's current pricing page before a large event.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Join says "Could not start a guest session" | Anonymous sign-ins not enabled (Part A), or signups disabled |
| "function ... does not exist" | A migration was not run (003/004/005 in order) |
| Player stuck on "Waiting for approval" | Admin has not approved; check Participants |
| Admin buttons show "Not authorised" | Not signed in as an allow-listed admin |
| Bids never update live | Migration 004 failed at its last statement (Realtime); the 5 s refresh still works. Send me the error |
