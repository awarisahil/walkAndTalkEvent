import { Link } from "react-router-dom";
import { fetchMyTickets } from "../../api/tickets";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDate } from "../../utils/format";
import "./DashboardPages.css";

export default function TicketsPage() {
  const query = useAsyncData(fetchMyTickets);

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading your tickets…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState message={query.message} onRetry={query.reload} />;
  }

  const tickets = query.data;

  return (
    <div>
      <header className="dash-page-header">
        <h1 className="dash-page-title">My tickets</h1>
        <p className="muted">Show your QR code at the venue entrance.</p>
      </header>

      {tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          message="Once your request is approved and paid, your ticket will appear here."
          action={
            <Link to="/events" className="btn btn-primary btn-sm">
              Browse events
            </Link>
          }
        />
      ) : (
        <div className="event-grid">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/dashboard/tickets/${ticket.id}`}
              className="card ticket-card"
              style={{ color: "var(--color-text)" }}
            >
              <span className="ticket-card-title">{ticket.event.title}</span>
              <span className="request-row-meta">
                {formatDate(ticket.event.date)} · {ticket.event.venue}
              </span>
              <span className="ticket-card-number">{ticket.ticketNumber}</span>
              <span>
                <StatusBadge status={ticket.status} kind="ticket" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
