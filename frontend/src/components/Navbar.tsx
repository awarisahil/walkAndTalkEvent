import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  function handleLogout() {
    logout();
    closeMenu();
    navigate("/");
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <span className="navbar-brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20c4-1 5-4 6-7s3-7 8-9" strokeDasharray="0" />
              <path d="M13.5 6.5c2.5-1 5.5-1 7.5.5-1 2.5-3.5 4-6.5 3.5" />
              <path d="M11 12.5c.8 2.2.5 4.5-.8 6.5-1.5-.5-2.5-2-2.2-4 .2-1 .8-2 2-2.5" />
            </svg>
          </span>
          Walk &amp; Talk Events
        </Link>

        <button
          type="button"
          className="navbar-toggle"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`navbar-toggle-bar${menuOpen ? " is-open" : ""}`} />
          <span className={`navbar-toggle-bar${menuOpen ? " is-open" : ""}`} />
          <span className={`navbar-toggle-bar${menuOpen ? " is-open" : ""}`} />
        </button>

        <nav className={`navbar-nav${menuOpen ? " is-open" : ""}`}>
          <NavLink to="/events" className="navbar-link" onClick={closeMenu}>
            Browse events
          </NavLink>
          <NavLink to="/community" className="navbar-link" onClick={closeMenu}>
            Community
          </NavLink>

          {user ? (
            <>
              {user.role === "ADMIN" ? (
                <NavLink to="/admin" className="navbar-link" onClick={closeMenu}>
                  Admin
                </NavLink>
              ) : (
                <NavLink to="/dashboard" className="navbar-link" onClick={closeMenu}>
                  Dashboard
                </NavLink>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="navbar-link" onClick={closeMenu}>
                Log in
              </NavLink>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={closeMenu}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
