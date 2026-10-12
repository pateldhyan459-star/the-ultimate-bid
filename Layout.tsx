import { Link, Outlet } from 'react-router-dom';
import BackendStatus from './BackendStatus';
import { eventConfig } from '../config/event';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const { isAdmin } = useAuth();
  return (
    <>
      <header className="header">
        <div className="wrap header__row">
          <Link to="/" className="brand" aria-label={`${eventConfig.title}, home`}>
            <span className="brand__mark">{eventConfig.title}</span>
            <span className="brand__fest">{eventConfig.festName}</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <Link to="/join">Join a room</Link>
            <Link to={isAdmin ? '/admin' : '/admin/login'}>
              {isAdmin ? 'Dashboard' : 'Organiser'}
            </Link>
          </nav>
        </div>
        <BackendStatus />
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="wrap footer__row">
          <span>
            {eventConfig.title} is part of {eventConfig.festName}
            {eventConfig.organiserName ? `, organised by ${eventConfig.organiserName}` : ''}.
          </span>
          <span>All sample auction data on this site is fictional.</span>
        </div>
      </footer>
    </>
  );
}
