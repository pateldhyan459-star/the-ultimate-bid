import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROOM_CODE_LENGTH } from '../config/event';
import { isValidRoomCode, normaliseRoomCode } from '../lib/roomCode';
import { isBackendConfigured, supabase } from '../lib/supabase';

type Errors = Partial<Record<'code' | 'name' | 'team' | 'form', string>>;

export default function Join() {
  const params = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(normaliseRoomCode(params.code ?? ''));
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!isValidRoomCode(code)) {
      next.code = `Room codes have ${ROOM_CODE_LENGTH} characters.`;
    }
    if (name.trim().length < 2) next.name = 'Enter a display name of at least 2 characters.';
    if (team.trim().length < 2) next.team = 'Enter a team name of at least 2 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !supabase) return;

    setBusy(true);
    // Players do not make accounts. Supabase gives each browser a private anonymous
    // identity, which the database uses to remember who you are.
    const { data: existing } = await supabase.auth.getSession();
    if (!existing.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setBusy(false);
        setErrors({ form: 'Could not start a guest session: ' + error.message });
        return;
      }
    }
    const { error } = await supabase.rpc('join_room', {
      p_code: code,
      p_display_name: name.trim(),
      p_team_name: team.trim(),
    });
    setBusy(false);
    if (error) {
      setErrors({ form: error.message });
      return;
    }
    navigate(`/room/${code}`);
  }

  return (
    <div className="wrap page-narrow">
      <div className="plate">
        <h1>Join a room</h1>
        <p className="lede">Enter the code from your organiser, then choose how you appear.</p>

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="code">Room code</label>
            <input
              id="code"
              className="code-input"
              value={code}
              onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.code ? true : undefined}
            />
            {errors.code && <span className="field__error" role="alert">{errors.code}</span>}
          </div>

          <div className="field">
            <label htmlFor="name">Display name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="nickname"
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && <span className="field__error" role="alert">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="team">Team name</label>
            <input
              id="team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              maxLength={40}
              autoComplete="off"
              aria-invalid={errors.team ? true : undefined}
            />
            <span className="field__hint">Teammates who enter the same name share one budget.</span>
            {errors.team && <span className="field__error" role="alert">{errors.team}</span>}
          </div>

          {errors.form && <span className="field__error" role="alert">{errors.form}</span>}
          <button className="btn" type="submit" disabled={!isBackendConfigured || busy}>
            {busy ? 'Joining...' : 'Request to join'}
          </button>
        </form>

        {!isBackendConfigured && (
          <p className="notice" role="status">
            No backend is connected, so nobody can join a room yet. The organiser must finish the
            Supabase setup first.
          </p>
        )}
      </div>
    </div>
  );
}
