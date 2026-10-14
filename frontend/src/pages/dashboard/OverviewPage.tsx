import { Link, useNavigate } from "react-router-dom";
import { fetchMyPaymentPendingRequests, fetchMyTicketRequests } from "../../api/requests";
import { fetchMyTickets } from "../../api/tickets";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/useAuth";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDate } from "../../utils/format";
import "./DashboardPages.css";

export default function OverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const query = useAsyncData(async () => {
    const [requests, awaiting, tickets] = await Promise.all([
      fetchMyTicketRequests(),
      fetchMyPaymentPendingRequests(),
      fetchMyTickets(),
    ]);
    return { requests, awaitingCount: awaiting.length, tickets };
  });

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading your dashboard…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState message={query.message} onRetry={query.reload} />;
  }

  const { requests, awaitingCount, tickets } = query.data;
  const pendingCount = requests.filter(
    (r) => r.status === "PENDING" || r.status === "APPROVED",
  ).length;
  const activeTickets = tickets.filter((t) => t.status === "ACTIVE").length;
  const recent = requests.slice(0, 5);

  return (
    <div>
      <header className="dash-page-header">
        <h1 className="dash-page-title">Hello, {user?.name.split(" ")[0]}</h1>
        <p className="muted">Here is what is happening with your events.</p>
      </header>

      <div className="stat-grid">
        <div className="card stat-card">
          <span className="stat-card-value">{pendingCount}</span>
          <span className="stat-card-label">Pending requests</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card-value">{awaitingCount}</span>
          <span className="stat-card-label">Awaiting payment</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card-value">{activeTickets}</span>
          <span className="stat-card-label">Active tickets</span>
        </div>
      </div>

      {awaitingCount > 0 ? (
        <section className="dash-section">
          <div className="card dash-card overview-pay-cta">
            <div className="overview-pay-cta-text">
              <h2 className="dash-section-title">
                You have {awaitingCount} payment{awaitingCount === 1 ? "" : "s"} waiting
              </h2>
              <p className="muted">
                Your spot is reserved — complete payment before the hold expires.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/dashboard/awaiting-payment")}
            >
              Complete payment →
            </button>
          </div>
        </section>
      ) : null}

      <section className="dash-section">
        <h2 className="dash-section-title">Recent requests</h2>
        {recent.length === 0 ? (
          <EmptyState
            title="No requests yet"
            message="Browse upcoming events and request your first ticket."
            action={
              <Link to="/events" className="btn btn-primary btn-sm">
                Browse events
              </Link>
            }
          />
        ) : (
          recent.map((request) => (
            <div className="request-row" key={request.id}>
              <div className="request-row-main">
                <Link to={`/dashboard/requests/${request.id}`} className="request-row-title">
                  {request.event.title}
                </Link>
                <span className="request-row-meta">
                  {formatDate(request.event.date)} · {request.event.venue}
                </span>
              </div>
              <StatusBadge status={request.status} kind="request" />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
