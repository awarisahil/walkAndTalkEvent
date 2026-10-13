import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Footer.css";

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="footer">
      <svg
        className="footer-trail"
        viewBox="0 0 320 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 18c30-14 50 6 80-6s50-14 80-2 50 4 76-8" strokeDasharray="1 7" />
        <ellipse cx="108" cy="12" rx="3" ry="4.5" transform="rotate(-18 108 12)" />
        <ellipse cx="122" cy="15" rx="3" ry="4.5" transform="rotate(-18 122 15)" />
      </svg>
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-brand-name">Walk &amp; Talk Events</span>
          <span className="footer-tagline">Curated experiences, thoughtfully hosted.</span>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <Link to="/events">Browse events</Link>
          {user ? null : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
