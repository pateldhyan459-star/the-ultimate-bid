import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Room } from '../types/db';

export default function AdminDashboard() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('1000000');
  const [increment, setIncrement] = useState('10000');
  const [timer, setTimer] = useState('30');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRooms((data ?? []) as Room[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('admin_create_room', {
      p_name: name,
      p_budget: Number(budget),
      p_increment: Number(increment),
      p_timer: Number(timer),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate(`/admin/rooms/${(data as Room).id}`);
  }

  return (
    <div className="wrap page-wide">
      <div className="room-head">
        <div>
          <h1>Organiser dashboard</h1>
          <p className="muted">Signed in as {session?.user.email}</p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={() => void signOut()}>Sign out</button>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="grid-2">
        <div className="plate stack">
          <h2>Your rooms</h2>
          {rooms === null ? <p className="muted">Loading...</p> : rooms.length === 0 ? (
            <p className="muted">No rooms yet. Create one.</p>
          ) : (
            <ul className="feed">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link to={`/admin/rooms/${r.id}`}>{r.name}</Link> · <code>{r.code}</code>{' '}
                  <span className="badge">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form className="plate form" onSubmit={(e) => void create(e)}>
          <h2>Create a room</h2>
          <div className="field"><label htmlFor="rn">Room name</label>
            <input id="rn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>
          <div className="field"><label htmlFor="rb">Budget per team (credits)</label>
            <input id="rb" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} /></div>
          <div className="field"><label htmlFor="ri">Minimum bid increment (credits)</label>
            <input id="ri" inputMode="numeric" value={increment} onChange={(e) => setIncrement(e.target.value.replace(/\D/g, ''))} /></div>
          <div className="field"><label htmlFor="rt">Seconds per lot (5 to 600)</label>
            <input id="rt" inputMode="numeric" value={timer} onChange={(e) => setTimer(e.target.value.replace(/\D/g, ''))} /></div>
          <button className="btn" type="submit" disabled={busy || name.trim().length < 2}>{busy ? 'Creating...' : 'Create room'}</button>
        </form>
      </div>
    </div>
  );
}
