import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Countdown from '../components/Countdown';
import Leaderboard from '../components/Leaderboard';
import { credits } from '../lib/money';
import { useRoomBundle, useServerOffset } from '../lib/room';
import { supabase } from '../lib/supabase';
import { normaliseRoomCode } from '../lib/roomCode';
import type { JoinStatus, Lot } from '../types/db';

/** The player's screen: waiting for approval, live bidding, and final results. */
export default function Room() {
  const { code: rawCode } = useParams();
  const code = normaliseRoomCode(rawCode ?? '');
  const navigate = useNavigate();
  const [me, setMe] = useState<JoinStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const approved = me?.participant_status === 'approved';

  // Ask the database who I am in this room. Repeats while waiting for approval.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    async function check() {
      const { data } = await client.rpc('my_join_status', { p_code: code });
      if (cancelled) return;
      setMe((data as JoinStatus | null) ?? null);
      setChecked(true);
    }
    void check();
    // Only keep asking while waiting for approval; after that, Realtime takes over.
    const id = approved ? undefined : window.setInterval(() => void check(), 4000);
    return () => {
      cancelled = true;
      if (id !== undefined) window.clearInterval(id);
    };
  }, [code, approved]);

  useEffect(() => {
    if (checked && !me) navigate(`/r/${code}`, { replace: true });
  }, [checked, me, code, navigate]);

  if (!supabase) return <Message title="No backend connected" body="The organiser must finish the Supabase setup." />;
  if (!checked || !me) return <Message title="Loading..." body="" />;
  if (me.participant_status === 'removed')
    return <Message title="Removed" body="The organiser has removed you from this room." />;
  if (me.participant_status === 'pending')
    return (
      <Message
        title={`Waiting for approval: ${me.room_name}`}
        body={`You joined as ${me.display_name} for team ${me.team_name}. The organiser must approve you. This page updates by itself.`}
      />
    );
  return <Live me={me} />;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="wrap page-narrow">
      <div className="plate">
        <h1>{title}</h1>
        {body && <p className="lede">{body}</p>}
        <Link to="/" className="btn btn--ghost">Home</Link>
      </div>
    </div>
  );
}

function Live({ me }: { me: JoinStatus }) {
  const { bundle, error, reload } = useRoomBundle(me.room_id);
  const offset = useServerOffset();
  const [amount, setAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teamName = useMemo(() => {
    const m = new Map<string, string>((bundle?.teams ?? []).map((t): [string, string] => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? 'Unknown team' : '');
  }, [bundle]);

  const finalize = useCallback(
    (lotId: string) => {
      // Random delay so a whole room does not call the server in the same instant.
      window.setTimeout(() => {
        void supabase?.rpc('finalize_lot', { p_lot_id: lotId }).then(() => reload());
      }, Math.random() * 1500);
    },
    [reload],
  );

  if (error && !bundle) return <Message title="Could not load the room" body={error} />;
  if (!bundle) return <Message title="Loading..." body="" />;

  const { room, lots, bids, purchases, leaderboard } = bundle;
  const active: Lot | undefined = lots.find((l) => l.status === 'live' || l.status === 'paused');
  const myRow = leaderboard.find((r) => r.team_id === me.team_id);
  const incr = active ? active.min_increment ?? room.min_increment : room.min_increment;
  const minBid = active ? (active.current_bid === null ? active.base_price : active.current_bid + incr) : 0;
  const iLead = !!active && active.current_team_id === me.team_id;

  async function submitBid(e: FormEvent, value?: number) {
    e.preventDefault();
    if (!active || !supabase) return;
    const n = value ?? Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setBidError('Enter a whole number of credits.');
      return;
    }
    setBusy(true);
    setBidError(null);
    const { error: err } = await supabase.rpc('place_bid', { p_lot_id: active.id, p_amount: Math.floor(n) });
    setBusy(false);
    if (err) setBidError(err.message);
    else setAmount('');
    void reload();
  }

  return (
    <div className="wrap page-wide">
      <div className="room-head">
        <div>
          <h1>{room.name}</h1>
          <p className="muted">
            {me.display_name} · team <strong>{me.team_name}</strong> · <span className="badge">{room.status}</span>
          </p>
        </div>
        <div className="budget">
          <span className="muted">Budget left</span>
          <strong>{credits(myRow?.remaining ?? 0)}</strong>
        </div>
      </div>

      {room.status === 'ended' ? (
        <div className="plate stack">
          <h2>Final results</h2>
          <Leaderboard rows={leaderboard} highlightTeamId={me.team_id} />
          <Purchases lots={lots} purchases={purchases} teamName={teamName} />
        </div>
      ) : (
        <div className="grid-2">
          <div className="plate stack">
            {active ? (
              <>
                <p className="muted">Lot {active.position}{active.category ? ` · ${active.category}` : ''}</p>
                <h2>{active.name}</h2>
                {active.description && <p>{active.description}</p>}
                <div className="bigrow">
                  <div>
                    <span className="muted">{active.current_bid === null ? 'Opening bid' : 'Current bid'}</span>
                    <strong className="bignum">{credits(active.current_bid ?? active.base_price)}</strong>
                    {active.current_team_id && <span className="muted">held by {teamName(active.current_team_id)}</span>}
                  </div>
                  <Countdown
                    endsAt={active.ends_at}
                    pausedMs={active.paused_remaining_ms}
                    offsetMs={offset}
                    onExpire={() => finalize(active.id)}
                  />
                </div>
                {room.status !== 'live' && <p className="notice">The organiser has paused the auction.</p>}
                {iLead && <p className="notice notice--ok">Your team holds the highest bid.</p>}
                <form className="form" onSubmit={(e) => void submitBid(e)} noValidate>
                  <div className="field">
                    <label htmlFor="bid">Your bid (minimum {credits(minBid)})</label>
                    <input id="bid" inputMode="numeric" value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                      placeholder={String(minBid)} />
                    {bidError && <span className="field__error" role="alert">{bidError}</span>}
                  </div>
                  <div className="btnrow">
                    <button className="btn" type="submit" disabled={busy || active.status !== 'live' || room.status !== 'live'}>Place bid</button>
                    <button className="btn btn--ghost" type="button"
                      disabled={busy || active.status !== 'live' || room.status !== 'live'}
                      onClick={(e) => void submitBid(e, minBid)}>
                      Bid minimum ({credits(minBid)})
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>{room.status === 'lobby' ? 'Waiting for the organiser to begin' : 'Waiting for the next lot'}</h2>
                <p className="muted">This screen updates by itself.</p>
              </>
            )}
            <h3>Recent bids</h3>
            {bids.length === 0 ? <p className="muted">No bids yet.</p> : (
              <ul className="feed">
                {bids.slice(0, 8).map((b) => (
                  <li key={b.id}>{teamName(b.team_id)} bid <strong>{credits(b.amount)}</strong> on {lots.find((l) => l.id === b.lot_id)?.name ?? 'a lot'}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="plate stack">
            <h2>Leaderboard</h2>
            <Leaderboard rows={leaderboard} highlightTeamId={me.team_id} />
            <h3>Lots</h3>
            <ul className="feed">
              {lots.map((l) => (
                <li key={l.id}>{l.position}. {l.name} <span className="badge">{l.status}</span>
                  {l.status === 'sold' && <> to {teamName(l.current_team_id)} for {credits(l.current_bid)}</>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function Purchases({ lots, purchases, teamName }: {
  lots: Lot[];
  purchases: { id: string; lot_id: string; team_id: string; price: number }[];
  teamName: (id: string | null) => string;
}) {
  if (purchases.length === 0) return <p className="muted">Nothing was sold.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Lot</th><th>Team</th><th>Price</th></tr></thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{lots.find((l) => l.id === p.lot_id)?.name ?? '?'}</td>
              <td>{teamName(p.team_id)}</td>
              <td>{credits(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
