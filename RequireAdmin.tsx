import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/**
 * Wraps admin pages. This only controls what the page SHOWS.
 * The real protection is in the database: even if someone bypassed this
 * component, Row Level Security would refuse to return any admin data.
 */
export default function RequireAdmin() {
  const { loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="wrap page-narrow">
        <p className="lede" role="status">Checking your sign in...</p>
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
