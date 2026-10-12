import { isBackendConfigured } from '../lib/supabase';

/**
 * Honest status line. Shows whether the browser has Supabase settings.
 * It does NOT prove the database tables exist; the admin dashboard runs that check.
 */
export default function BackendStatus() {
  if (isBackendConfigured) {
    return (
      <div className="status status--on" role="status">
        <div className="wrap status__row">
          <span className="status__dot" aria-hidden="true" />
          <span>
            <strong>Backend settings found.</strong> Rooms, joining and live bidding are available once
            the database migrations have been run.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="status" role="status">
      <div className="wrap status__row">
        <span className="status__dot" aria-hidden="true" />
        <span>
          <strong>Preview mode.</strong> No backend is configured, so rooms, joining and bidding
          are switched off. Follow the README to connect Supabase.
        </span>
      </div>
    </div>
  );
}
