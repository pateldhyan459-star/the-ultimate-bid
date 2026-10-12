import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isBackendConfigured } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loading, isAdmin, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && isAdmin) return <Navigate to="/admin" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Passwords have at least 8 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/admin', { replace: true });
  }

  return (
    <div className="wrap page-narrow">
      <div className="plate">
        <h1>Organiser sign in</h1>
        <p className="lede">Only approved administrators can create rooms and change auction rules.</p>

        {!isBackendConfigured && (
          <p className="notice" role="status">
            No backend is connected, so nobody can sign in yet. Add your Supabase values to the
            .env file (see the README) and restart <code>npm run dev</code>.
          </p>
        )}

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={!isBackendConfigured || busy}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={!isBackendConfigured || busy}
            />
            {error && <span className="field__error" role="alert">{error}</span>}
          </div>
          <button className="btn" type="submit" disabled={!isBackendConfigured || busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
