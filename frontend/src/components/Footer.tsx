import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Footer.css";

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="footer">
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
