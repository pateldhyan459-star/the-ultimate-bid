# Roadmap

## Stage 2: Authentication and database (code written; awaiting owner setup and testing)
- Tables: admins, rooms, participants, teams, lots, bids, purchases (with money in whole credits).
- Row Level Security so participants can only read their own room and can never edit budgets or rules.
- Administrator sign in with Supabase Auth plus an admin allow-list.
- Demo data, clearly marked fictional.

## Stage 3: Rooms and joining (written, untested)
- Create and edit rooms, generate unique 6-character codes and invitation links (`/r/CODE`).
- Participant join flow with display name and team name; organiser approves or removes.

## Stage 4: Live bidding (written, untested)
- `place_bid` database function that locks the lot row, checks status, increment and team budget in one transaction.
- Server-side deadlines: the clock lives in the database, browsers only display it.
- Realtime updates per room, with state reloaded on refresh or reconnect.

## Stage 5: Administrator dashboard (written, untested)
- Lots, budgets, opening bids, increments, timer length.
- Start, pause, resume, end; live activity feed.

## Stage 6: Leaderboard and results (written, untested)
- Team balances, purchases and final rankings; CSV export.

## Stage 7: Testing and deployment
- Concurrency tests for simultaneous bids, mobile checks, deployment guide with free-tier limits.
