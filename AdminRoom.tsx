import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Countdown from '../components/Countdown';
import Leaderboard from '../components/Leaderboard';
import { credits, downloadCsv } from '../lib/money';
import { useRoomBundle, useServerOffset } from '../lib/room';
import { supabase } from '../lib/supabase';
import { Purchases } from './Room';

export default function AdminRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bundle, error, reload } = useRoomBundle(id ?? null, true);
  const offset = useServerOffset();
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const teamName = useMemo(() => {
    const m = new Map<string, string>((bundle?.teams ?? []).map((t): [string, string] => [t.id, t.name]));
    return (tid: string | null) => (tid ? m.get(tid) ?? '?' : '');
  }, [bundle]);

  /** Run a database action, show its error (from the server) if refused, then refresh. */
  const run = useCallback(
    async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
      setMsg(null);
      const { error: err } = await action();
      if (err) setMsg(err.message);
      void reload();
    },
    [reload],
  );

  if (!supabase || !id) return null;
  const db = supabase;
  if (error && !bundle) return <div className="wrap page-wide"><p className="notice" role="alert">{error}</p></div>;
  if (!bundle) return <div className="wrap page-wide"><p className="muted">Loading...</p></div>;

  const { room, lots, teams, participants, bids, purchases, leaderboard } = bundle;
  const link = `${window.location.origin}/r/${room.code}`;
  const active = lots.find((l) => l.status === 'live' || l.status === 'paused');
  const pending = participants.filter((p) => p.status === 'pending');

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  function exportCsv() {
    downloadCsv(`${room.code}-results.csv`, [
      ['Rank', 'Team', 'Lots won', 'Spent (credits)', 'Remaining (credits)'],
      ...leaderboard.map((r, i) => [i + 1, r.team_name, r.lots_won, r.spent, r.remaining]),
      [],
      ['Lot', 'Team', 'Price (credits)'],
      ...purchases.map((p) => [lots.find((l) => l.id === p.lot_id)?.name ?? '', teamName(p.team_id), p.price]),
    ]);
  }

  return (
    <div className="wrap page-wide stack">
      <div className="room-head">
        <div>
          <p className="muted"><Link to="/admin">All rooms</Link></p>
          <h1>{room.name}</h1>
          <p>Code <code className="bigcode">{room.code}</code> <span className="badge">{room.status}</span></p>
        </div>
        <div className="btnrow">
          <button className="btn btn--ghost" onClick={() => copy(room.code, 'code')}>{copied === 'code' ? 'Copied' : 'Copy code'}</button>
          <button className="btn btn--ghost" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied' : 'Copy invite link'}</button>
          <a className="btn btn--ghost" href={`/admin/rooms/${room.id}/screen`} target="_blank" rel="noreferrer">Open projector view</a>
          <button className="btn btn--ghost" onClick={() => {
            if (window.confirm(`Delete the room "${room.name}" and ALL its teams, lots, bids and results? This cannot be undone.`)) {
              void db.from('rooms').delete().eq('id', room.id).then(({ error: err }) => {
                if (err) setMsg(err.message); else navigate('/admin');
              });
            }
          }}>Delete room</button>
        </div>
      </div>
      <p className="field__hint">Invite link: {link}</p>
      {msg && <p className="notice" role="alert">{msg}</p>}

      <div className="plate stack">
        <h2>Auction controls</h2>
        <div className="btnrow">
          <button className="btn" disabled={room.status === 'live' || room.status === 'ended'}
            onClick={() => void run(() => db.rpc('admin_set_room_status', { p_room_id: room.id, p_status: 'live' }))}>Go live</button>
          <button className="btn btn--ghost" disabled={room.status !== 'live'}
            onClick={() => void run(() => db.rpc('admin_set_room_status', { p_room_id: room.id, p_status: 'paused' }))}>Pause auction</button>
          <button className="btn btn--ghost" disabled={room.status === 'ended'}
            onClick={() => { if (window.confirm('End the auction? This cannot be undone.')) void run(() => db.rpc('admin_set_room_status', { p_room_id: room.id, p_status: 'ended' })); }}>End auction</button>
        </div>
        <p className="field__hint">Pausing the auction pauses the running lot. After going live again, press Resume on the lot.</p>
        {active && (
          <div className="bigrow">
            <div>
              <span className="muted">Running: {active.name}</span>
              <strong className="bignum">{credits(active.current_bid ?? active.base_price)}</strong>
              <span className="muted">{active.current_team_id ? `held by ${teamName(active.current_team_id)}` : 'no bids yet'}</span>
            </div>
            <Countdown endsAt={active.ends_at} pausedMs={active.paused_remaining_ms} offsetMs={offset}
              onExpire={() => void db.rpc('finalize_lot', { p_lot_id: active.id }).then(() => reload())} />
          </div>
        )}
      </div>

      <div className="grid-2">
        <Participants pending={pending.length} rows={participants.map((p) => ({ ...p, team: teamName(p.team_id) }))}
          onSet={(pid, status) => void run(() => db.from('participants').update({ status }).eq('id', pid))}
          onApproveAll={() => void run(() => db.from('participants').update({ status: 'approved' }).eq('room_id', room.id).eq('status', 'pending'))} />
        <div className="plate stack">
          <h2>Teams and budgets</h2>
          {teams.length === 0 ? <p className="muted">Teams appear when players join.</p> : teams.map((t) => (
            <BudgetEditor key={t.id} name={t.name} budget={t.budget}
              onSave={(n) => void run(() => db.from('teams').update({ budget: n }).eq('id', t.id))} />
          ))}
          <RoomSettings room={room} onSave={(v) => void run(() => db.from('rooms').update(v).eq('id', room.id))} />
        </div>
      </div>

      <div className="plate stack">
        <h2>Lots</h2>
        <AddLot nextPosition={(lots.length > 0 ? lots[lots.length - 1].position : 0) + 1}
          onAdd={(v) => void run(() => db.from('lots').insert({ ...v, room_id: room.id }))} />
        {lots.length === 0 ? <p className="muted">No lots yet.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Lot</th><th>Opening</th><th>Status</th><th>Result</th><th>Actions</th></tr></thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id}>
                    <td>{l.position}</td><td>{l.name}</td><td>{credits(l.base_price)}</td>
                    <td><span className="badge">{l.status}</span></td>
                    <td>{l.status === 'sold' ? `${teamName(l.current_team_id)} · ${credits(l.current_bid)}` : ''}</td>
                    <td className="btnrow">
                      {(l.status === 'sold' || l.status === 'unsold') && room.status !== 'ended' &&
                        <button className="btn btn--sm btn--ghost" onClick={() => { if (window.confirm('Put this lot back to upcoming? Its bids and sale are erased and the budget is returned.')) void run(() => db.rpc('admin_reset_lot', { p_lot_id: l.id })); }}>Reset</button>}
                      {l.status === 'upcoming' && <>
                        <button className="btn btn--sm" onClick={() => void run(() => db.rpc('admin_start_lot', { p_lot_id: l.id }))}>Start</button>
                        <button className="btn btn--sm btn--ghost" onClick={() => {
                          const n = window.prompt('Lot name', l.name);
                          if (n === null) return;
                          const p = window.prompt('Opening bid (credits)', String(l.base_price));
                          if (p === null || !/^\d+$/.test(p.trim()) || n.trim().length < 1) { setMsg('Edit cancelled: enter a name and a whole-number opening bid.'); return; }
                          void run(() => db.from('lots').update({ name: n.trim(), base_price: Number(p) }).eq('id', l.id));
                        }}>Edit</button>
                        <button className="btn btn--sm btn--ghost" onClick={() => { if (window.confirm('Delete this lot?')) void run(() => db.from('lots').delete().eq('id', l.id)); }}>Delete</button>
                      </>}
                      {l.status === 'live' && <button className="btn btn--sm btn--ghost" onClick={() => void run(() => db.rpc('admin_pause_lot', { p_lot_id: l.id }))}>Pause</button>}
                      {l.status === 'paused' && <button className="btn btn--sm" onClick={() => void run(() => db.rpc('admin_resume_lot', { p_lot_id: l.id }))}>Resume</button>}
                      {(l.status === 'live' || l.status === 'paused') &&
                        <button className="btn btn--sm btn--ghost" onClick={() => void run(() => db.rpc('admin_end_lot', { p_lot_id: l.id }))}>End now</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="plate stack">
          <h2>Activity</h2>
          {bids.length === 0 ? <p className="muted">No bids yet.</p> : (
            <ul className="feed">
              {bids.slice(0, 15).map((b) => (
                <li key={b.id}>{new Date(b.created_at).toLocaleTimeString()} · {teamName(b.team_id)} bid {credits(b.amount)} on {lots.find((l) => l.id === b.lot_id)?.name ?? '?'}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="plate stack">
          <h2>Leaderboard</h2>
          <Leaderboard rows={leaderboard} />
          <h3>Purchases</h3>
          <Purchases lots={lots} purchases={purchases} teamName={teamName} />
          <button className="btn btn--ghost" onClick={exportCsv}>Download results (CSV)</button>
        </div>
      </div>
    </div>
  );
}

function Participants({ rows, pending, onSet, onApproveAll }: {
  rows: { id: string; display_name: string; team: string; status: string }[];
  pending: number;
  onSet: (id: string, status: 'approved' | 'removed' | 'pending') => void;
  onApproveAll: () => void;
}) {
  return (
    <div className="plate stack">
      <h2>Participants ({rows.length})</h2>
      {pending > 0 && <button className="btn btn--sm" onClick={onApproveAll}>Approve all {pending} pending</button>}
      {rows.length === 0 ? <p className="muted">Nobody has joined yet.</p> : (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.display_name}</td><td>{p.team}</td><td><span className="badge">{p.status}</span></td>
                  <td className="btnrow">
                    {p.status !== 'approved' && <button className="btn btn--sm" onClick={() => onSet(p.id, 'approved')}>Approve</button>}
                    {p.status !== 'removed' && <button className="btn btn--sm btn--ghost" onClick={() => onSet(p.id, 'removed')}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetEditor({ name, budget, onSave }: { name: string; budget: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(budget));
  return (
    <div className="inline">
      <span>{name}</span>
      <input aria-label={`Budget for ${name}`} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} />
      <button className="btn btn--sm btn--ghost" disabled={v === '' || Number(v) === budget} onClick={() => onSave(Number(v))}>Save</button>
    </div>
  );
}

function RoomSettings({ room, onSave }: {
  room: { name: string; default_budget: number; min_increment: number; timer_seconds: number };
  onSave: (v: { name: string; default_budget: number; min_increment: number; timer_seconds: number }) => void;
}) {
  const [nm, setNm] = useState(room.name);
  const [b, setB] = useState(String(room.default_budget));
  const [i, setI] = useState(String(room.min_increment));
  const [t, setT] = useState(String(room.timer_seconds));
  const digits = (f: (s: string) => void) => (e: { target: { value: string } }) => f(e.target.value.replace(/\D/g, ''));
  return (
    <div className="form">
      <h3>Room rules</h3>
      <div className="field"><label htmlFor="sn">Room name</label><input id="sn" value={nm} onChange={(e) => setNm(e.target.value)} maxLength={80} /></div>
      <div className="field"><label htmlFor="sb">Default budget for NEW teams</label><input id="sb" inputMode="numeric" value={b} onChange={digits(setB)} /></div>
      <div className="field"><label htmlFor="si">Minimum increment</label><input id="si" inputMode="numeric" value={i} onChange={digits(setI)} /></div>
      <div className="field"><label htmlFor="st">Seconds per lot (applies when a lot starts)</label><input id="st" inputMode="numeric" value={t} onChange={digits(setT)} /></div>
      <button className="btn btn--sm btn--ghost" onClick={() => onSave({ name: nm.trim(), default_budget: Number(b), min_increment: Number(i), timer_seconds: Number(t) })}>Save rules</button>
    </div>
  );
}

function AddLot({ nextPosition, onAdd }: {
  nextPosition: number;
  onAdd: (v: { position: number; name: string; description: string | null; category: string | null; base_price: number }) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [price, setPrice] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    onAdd({ position: nextPosition, name: name.trim(), description: desc.trim() || null, category: cat.trim() || null, base_price: Number(price) });
    setName(''); setDesc(''); setCat(''); setPrice('');
  }
  return (
    <form className="form form--row" onSubmit={submit}>
      <div className="field"><label htmlFor="ln">Lot name</label><input id="ln" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
      <div className="field"><label htmlFor="lc">Category</label><input id="lc" value={cat} onChange={(e) => setCat(e.target.value)} /></div>
      <div className="field"><label htmlFor="ld">Description</label><input id="ld" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field"><label htmlFor="lp">Opening bid (credits)</label><input id="lp" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></div>
      <button className="btn" type="submit" disabled={name.trim().length < 1 || price === ''}>Add lot</button>
    </form>
  );
}
