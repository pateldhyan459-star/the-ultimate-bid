import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Countdown from '../components/Countdown';
import { credits } from '../lib/money';
import { useRoomBundle, useServerOffset } from '../lib/room';
import { supabase } from '../lib/supabase';

/** Full-screen view for a projector. Signed-in organiser only. Shows the join code too. */
export default function Screen() {
  const { id } = useParams();
  const { bundle, error, reload } = useRoomBundle(id ?? null, true);
  const offset = useServerOffset();

  const teamName = useMemo(() => {
    const m = new Map<string, string>((bundle?.teams ?? []).map((t): [string, string] => [t.id, t.name]));
    return (tid: string | null) => (tid ? m.get(tid) ?? '?' : '');
  }, [bundle]);

  if (error && !bundle) return <div className="screen"><p>{error}</p></div>;
  if (!bundle) return <div className="screen"><p>Loading...</p></div>;

  const { room, lots, bids, leaderboard } = bundle;
  const active = lots.find((l) => l.status === 'live' || l.status === 'paused');
  const joinUrl = `${window.location.host}/r/${room.code}`;

  return (
    <div className="screen">
      <header className="screen__top">
        <div>
          <p className="hero__fest">FEST INFINITO</p>
          <h1>{room.name}</h1>
        </div>
        <div className="screen__join">
          <span>Join at {joinUrl}</span>
          <strong className="bigcode">{room.code}</strong>
        </div>
      </header>

      <section className="screen__lot">
        {room.status === 'ended' ? (
          <h2>Auction complete</h2>
        ) : active ? (
          <>
            <p className="muted">Lot {active.position}{active.category ? ` · ${active.category}` : ''}</p>
            <h2>{active.name}</h2>
            <div className="screen__nums">
              <div>
                <span className="muted">{active.current_bid === null ? 'Opening bid' : 'Current bid'}</span>
                <strong className="screen__bid">{credits(active.current_bid ?? active.base_price)}</strong>
                <span className="screen__team">{active.current_team_id ? teamName(active.current_team_id) : 'No bids yet'}</span>
              </div>
              <div className="screen__clock">
                <Countdown
                  endsAt={active.ends_at}
                  pausedMs={active.paused_remaining_ms}
                  offsetMs={offset}
                  onExpire={() => void supabase?.rpc('finalize_lot', { p_lot_id: active.id }).then(() => reload())}
                />
              </div>
            </div>
          </>
        ) : (
          <h2>{room.status === 'lobby' ? 'Starting soon' : 'Next lot coming up'}</h2>
        )}
      </section>

      <section className="screen__cols">
        <div>
          <h3>Leaderboard</h3>
          <ol className="screen__list">
            {leaderboard.slice(0, 8).map((r) => (
              <li key={r.team_id}><span>{r.team_name}</span><span>{r.lots_won} won · {credits(r.remaining)} left</span></li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Latest bids</h3>
          <ul className="screen__list">
            {bids.slice(0, 6).map((b) => (
              <li key={b.id}><span>{teamName(b.team_id)}</span><span>{credits(b.amount)}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
