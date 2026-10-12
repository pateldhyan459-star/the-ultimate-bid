import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap page-narrow">
      <div className="plate">
        <h1>Page not found</h1>
        <p className="lede">This address does not match any page. Check the link, or go back to the start.</p>
        <Link to="/" className="btn">
          Back to home
        </Link>
      </div>
    </div>
  );
}
