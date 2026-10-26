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
          Walk &amp; Talk
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
          ) : null}
        </nav>
      </div>
    </header>
  );
}
