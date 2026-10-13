import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />
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
