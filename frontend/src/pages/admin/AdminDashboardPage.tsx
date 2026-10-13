import { Link } from "react-router-dom";
import { fetchAdminEvents } from "../../api/events";
import { fetchAdminPayments } from "../../api/payments";
import { fetchAdminTicketRequests } from "../../api/requests";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDateTime, formatINR } from "../../utils/format";
import "./AdminPages.css";
import "./AdminDashboardPage.css";

export default function AdminDashboardPage() {
  const query = useAsyncData(async () => {
    const [allEvents, publishedEvents, pending, confirmedPayments, recentPayments] =
      await Promise.all([
        fetchAdminEvents({ page: 1, pageSize: 1 }),
        fetchAdminEvents({ page: 1, pageSize: 1, status: "PUBLISHED" }),
        fetchAdminTicketRequests({ status: "PENDING", page: 1, pageSize: 5 }),
        fetchAdminPayments({ status: "SUCCESS", page: 1, pageSize: 1 }),
        fetchAdminPayments({ page: 1, pageSize: 5 }),
      ]);
    return {
      totalEvents: allEvents.meta.total,
      publishedEvents: publishedEvents.meta.total,
      pendingCount: pending.meta.total,
      needsReview: pending.items,
      confirmedTickets: confirmedPayments.meta.total,
      recentPayments: recentPayments.items,
    };
  });

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading dashboard…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState message={query.message} onRetry={query.reload} />;
  }

  const { totalEvents, publishedEvents, pendingCount, needsReview, confirmedTickets, recentPayments } =
    query.data;

  return (
    <div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="muted">Platform activity at a glance.</p>
      </header>

      <div className="stat-grid">
        <div className="card stat-card">
          <span className="stat-card-value">{totalEvents}</span>
          <span className="stat-card-label">Total events</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card-value">{publishedEvents}</span>
          <span className="stat-card-label">Published events</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card-value">{pendingCount}</span>
          <span className="stat-card-label">Pending review</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card-value">{confirmedTickets}</span>
          <span className="stat-card-label">Confirmed tickets</span>
        </div>
      </div>

      <div className="admin-dash-columns">
        <section className="admin-section admin-dash-column">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Needs review</h2>
            <Link to="/admin/requests?status=PENDING" className="admin-section-link">
              View all →
            </Link>
          </div>
          {needsReview.length === 0 ? (
            <p className="muted admin-dash-empty">No requests waiting for review.</p>
          ) : (
            needsReview.map((request) => (
              <div className="request-row" key={request.id}>
                <div className="request-row-main">
                  <span className="request-row-title">{request.user.name}</span>
                  <span className="request-row-meta">
                    {request.event.title} · {formatDateTime(request.event.date)}
                  </span>
                  <span className="request-row-meta">{request.user.email}</span>
                </div>
                <div className="request-row-actions">
                  <Link
                    to={`/admin/requests?status=PENDING&eventId=${request.event.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="admin-section admin-dash-column">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Recent payments</h2>
            <Link to="/admin/payments" className="admin-section-link">
              View all →
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="muted admin-dash-empty">No payments yet.</p>
          ) : (
            recentPayments.map((payment) => (
              <div className="request-row" key={payment.id}>
                <div className="request-row-main">
                  <span className="request-row-title">{payment.user.name}</span>
                  <span className="request-row-meta">
                    {payment.event.title} · {formatINR(payment.amount)}
                  </span>
                  <span className="request-row-meta">
                    {formatDateTime(payment.createdAt)}
                  </span>
                </div>
                <div className="request-row-actions">
                  <StatusBadge status={payment.status} kind="payment" />
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
