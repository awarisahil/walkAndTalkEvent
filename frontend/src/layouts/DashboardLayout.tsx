import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./DashboardLayout.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/requests", label: "My Requests" },
  { to: "/dashboard/awaiting-payment", label: "Awaiting Payment" },
  { to: "/dashboard/payments", label: "Payments" },
  { to: "/dashboard/tickets", label: "My Tickets" },
  { to: "/dashboard/profile", label: "Profile" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <nav className="dashboard-nav" aria-label="Dashboard">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className="dashboard-nav-link"
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="dashboard-menu-btn"
            aria-expanded={sidebarOpen}
            aria-label="Toggle dashboard menu"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="dashboard-topbar-user">
            <span className="dashboard-topbar-name">{user?.name}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
