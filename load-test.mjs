// =====================================================================
// THE ULTIMATE BID - automated multi-player test
// Creates a throwaway room, joins several fake guest players, and checks the
// server rules: simultaneous bids, minimum bid, budget, permissions, timer.
// It deletes the room at the end.
//
// Run from the project folder (see docs/TESTING_STAGE10.md):
//   set ADMIN_EMAIL=you@example.com
//   set ADMIN_PASSWORD=your-password
//   node --env-file=.env scripts/load-test.mjs
//
// The admin password is read from your own terminal session only. It is never
// saved to a file. Needs Node 22 or newer (native WebSocket).
// =====================================================================
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;
const N = Math.max(3, Number(process.env.PLAYERS ?? 8));

if (!URL || !KEY || !EMAIL || !PASS) {
  console.error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ADMIN_EMAIL or ADMIN_PASSWORD.');
  process.exit(2);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const msg = (r) => r?.error?.message ?? '';

const admin = client();
let roomId = null;

try {
  const login = await admin.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (login.error) throw new Error('Admin sign-in failed: ' + login.error.message);
  const isAdmin = await admin.rpc('is_admin');
  check('Admin account is on the allow-list', isAdmin.data === true);
  if (isAdmin.data !== true) throw new Error('Not an admin');

  const created = await admin.rpc('admin_create_room', {
    p_name: `LOADTEST ${new Date().toISOString()}`, p_budget: 100000, p_increment: 1000, p_timer: 60,
  });
  if (created.error) throw new Error('Create room failed: ' + created.error.message);
  roomId = created.data.id;
  const code = created.data.code;
  check('Room created with a 6-character code', /^[A-Z2-9]{6}$/.test(code), code);

  const lotRows = await admin.from('lots').insert([
    { room_id: roomId, position: 1, name: 'Test Lot 1', base_price: 5000 },
    { room_id: roomId, position: 2, name: 'Test Lot 2', base_price: 5000 },
  ]).select();
  if (lotRows.error) throw new Error('Add lots failed: ' + lotRows.error.message);
  const [lot1, lot2] = lotRows.data.sort((a, b) => a.position - b.position);

  // Fake players (each is its own anonymous guest with its own team).
  const players = [];
  for (let i = 0; i < N; i++) {
    const c = client();
    const s = await c.auth.signInAnonymously();
    if (s.error) throw new Error(`Guest sign-in ${i + 1} failed: ${s.error.message} (anonymous sign-in limit? see docs)`);
    const j = await c.rpc('join_room', { p_code: code, p_display_name: `Tester ${i + 1}`, p_team_name: `LT Team ${i + 1}` });
    if (j.error) throw new Error('Join failed: ' + j.error.message);
    players.push(c);
  }
  check(`${N} guest players joined`, players.length === N);

  const pendingBid = await players[0].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 5000 });
  check('Pending (unapproved) player cannot bid', !!pendingBid.error, msg(pendingBid));

  const appr = await admin.from('participants').update({ status: 'approved' }).eq('room_id', roomId);
  check('Admin approved all players', !appr.error, msg(appr));

  const early = await players[0].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 5000 });
  check('Cannot bid before the room is live', !!early.error, msg(early));

  check('Admin sets room live', !(await admin.rpc('admin_set_room_status', { p_room_id: roomId, p_status: 'live' })).error);
  check('Admin starts lot 1', !(await admin.rpc('admin_start_lot', { p_lot_id: lot1.id })).error);

  const low = await players[1].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 100 });
  check('Bid below opening price is refused', !!low.error, msg(low));

  const rich = await players[1].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 100001 });
  check('Bid above team budget is refused', !!rich.error && /budget/i.test(msg(rich)), msg(rich));

  // The key test: everyone bids the same amount at the same instant.
  const race = await Promise.all(players.map((p) => p.rpc('place_bid', { p_lot_id: lot1.id, p_amount: 5000 })));
  const wins = race.filter((r) => !r.error).length;
  check(`Simultaneous identical bids: exactly 1 of ${N} accepted`, wins === 1, `${wins} accepted`);
  const bidRows = await admin.from('bids').select('id').eq('lot_id', lot1.id);
  check('Exactly 1 bid row stored', bidRows.data?.length === 1, String(bidRows.data?.length));
  const winnerIdx = race.findIndex((r) => !r.error);

  const self = await players[winnerIdx].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 9000 });
  check('Leader cannot outbid their own team', !!self.error, msg(self));

  const other = (winnerIdx + 1) % N;
  const outbid = await players[other].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 6000 });
  check('Another team can outbid at current + increment', !outbid.error, msg(outbid));
  const tooSmall = await players[winnerIdx].rpc('place_bid', { p_lot_id: lot1.id, p_amount: 6500 });
  check('Bid under current + increment is refused', !!tooSmall.error, msg(tooSmall));

  // Permissions
  const stranger = client();
  await stranger.auth.signInAnonymously();
  const strangerBid = await stranger.rpc('place_bid', { p_lot_id: lot1.id, p_amount: 20000 });
  check('Non-participant cannot bid', !!strangerBid.error, msg(strangerBid));
  const adminCall = await players[0].rpc('admin_end_lot', { p_lot_id: lot1.id });
  check('Player cannot call admin functions', !!adminCall.error && /authoris/i.test(msg(adminCall)), msg(adminCall));
  const tamper = await players[0].from('lots').update({ current_bid: 1 }).eq('id', lot1.id).select();
  check('Player cannot edit lots directly', !!tamper.error || (tamper.data ?? []).length === 0);
  const forge = await players[0].from('bids').insert({ room_id: roomId, lot_id: lot1.id, team_id: lot1.id, amount: 99999 });
  check('Player cannot insert bids directly', !!forge.error, msg(forge));
  const budgetEdit = await players[0].from('teams').update({ budget: 999999999 }).eq('room_id', roomId).select();
  check('Player cannot edit team budgets', !!budgetEdit.error || (budgetEdit.data ?? []).length === 0);
  const anonRooms = await stranger.from('rooms').select('id');
  check('Non-participant sees no rooms', (anonRooms.data ?? []).length === 0);

  // Close lot 1 and verify the sale.
  check('Admin ends lot 1', !(await admin.rpc('admin_end_lot', { p_lot_id: lot1.id })).error);
  const sold = await admin.from('lots').select('status,current_bid').eq('id', lot1.id).single();
  check('Lot 1 is sold at 6000', sold.data?.status === 'sold' && sold.data?.current_bid === 6000, JSON.stringify(sold.data));
  const board = await admin.rpc('room_leaderboard', { p_room_id: roomId });
  const top = board.data?.[0];
  check('Leaderboard shows winner spent 6000, 94000 left', top?.spent === 6000 && top?.remaining === 94000, JSON.stringify(top));

  // Server-side timer: shorten to 5 seconds, then bid after expiry.
  await admin.from('rooms').update({ timer_seconds: 5 }).eq('id', roomId);
  check('Admin starts lot 2 (5 second timer)', !(await admin.rpc('admin_start_lot', { p_lot_id: lot2.id })).error);
  const firstBid = await players[2].rpc('place_bid', { p_lot_id: lot2.id, p_amount: 5000 });
  check('Bid inside the time limit accepted', !firstBid.error, msg(firstBid));
  await sleep(6500);
  const late = await players[3].rpc('place_bid', { p_lot_id: lot2.id, p_amount: 7000 });
  check('Bid after the server deadline refused', !!late.error && /time is up/i.test(msg(late)), msg(late));
  await players[3].rpc('finalize_lot', { p_lot_id: lot2.id });
  const again = await players[4 % N].rpc('finalize_lot', { p_lot_id: lot2.id });
  const lot2After = await admin.from('lots').select('status').eq('id', lot2.id).single();
  check('Expired lot closed by a player and sold', lot2After.data?.status === 'sold' && !again.error, JSON.stringify(lot2After.data));
  const purchases = await admin.from('purchases').select('id').eq('room_id', roomId);
  check('Exactly 2 purchases recorded (no duplicates)', purchases.data?.length === 2, String(purchases.data?.length));
} catch (e) {
  console.error('\nTEST ABORTED:', e.message);
  results.push({ name: 'Test run completed', ok: false });
} finally {
  if (roomId) {
    const del = await admin.from('rooms').delete().eq('id', roomId);
    console.log(del.error ? `\nCould not delete test room: ${del.error.message}` : '\nTest room deleted.');
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed.`);
  console.log('Guest accounts created by this test stay in Authentication -> Users; see docs/TESTING_STAGE10.md to clear them.');
  process.exit(failed ? 1 : 0);
}
