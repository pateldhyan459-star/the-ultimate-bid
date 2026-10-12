# Supabase folder

| File | When to run | Purpose |
| --- | --- | --- |
| `migrations/001_schema.sql` | 1st | Creates the tables |
| `migrations/002_security.sql` | 2nd | Row Level Security and admin helper functions |
| `migrations/003_rooms_and_joining.sql` | after Stage 2 works | Room creation, codes, join function |
| `migrations/004_bidding.sql` | next | Bidding, timer, admin controls, Realtime |
| `migrations/005_leaderboard.sql` | next | Leaderboard function |
| `migrations/006_admin_extras.sql` | last | Reset (re-auction) a lot |
| `manual/add_admin.sql` | 3rd (after creating your user) | Adds you to the admin allow-list |
| `manual/verify_security.sql` | any time | Read-only security check |
| `seed.sql` | optional, last | Fictional demo room |

Run each by pasting it into the Supabase SQL Editor. Full steps are in the main README.
Run the migrations once, in order. Do not run 001 twice (the tables already exist).
