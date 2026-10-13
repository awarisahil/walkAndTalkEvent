import { Link, useParams } from "react-router-dom";
import { fetchAdminEvent } from "../../api/events";
import Badge from "../../components/Badge";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDateTime, formatEventTime, formatINR } from "../../utils/format";
import EventActions from "./EventActions";
import "./AdminPages.css";
import "./AdminEventDetailPage.css";

export default function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAsyncData(() => fetchAdminEvent(id ?? ""), [id]);

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading event…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState title="Event unavailable" message={query.message} onRetry={query.reload} />;
  }

  const event = query.data;
  const counts = event.requestCounts;
  const chipData: Array<{ label: string; value: number; tone?: string }> = [
    { label: "Pending", value: counts.pending },
    { label: "Awaiting payment", value: counts.paymentPending },
    { label: "Paid", value: counts.paid },
    { label: "Rejected", value: counts.rejected },
    { label: "Cancelled", value: counts.cancelled },
    { label: "Expired", value: counts.expired },
  ];

  return (
    <div>
      <header className="admin-page-header">
        <Link to="/admin/events" className="muted" style={{ fontSize: "0.875rem" }}>
          ← Back to events
        </Link>
        <div className="admin-event-detail-head">
          <div>
            <h1 className="admin-page-title">{event.title}</h1>
            <p className="muted">
              {formatEventTime(event.date, event.startTime, event.endTime)} · {event.venue}
            </p>
          </div>
          <StatusBadge status={event.status} kind="event" />
        </div>
      </header>

      <div className="admin-event-detail-body">
        <section className="admin-section">
          <div className="card admin-card">
            <div className="detail-grid" style={{ marginBottom: 20 }}>
              <div className="detail-item">
                <span className="detail-item-label">Ticket price</span>
                <span className="detail-item-value">
                  {Number(event.ticketPrice) === 0 ? "Free" : formatINR(event.ticketPrice)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Availability</span>
                <span className="detail-item-value">
                  {event.occupied} of {event.capacity} taken · {event.available} available
                </span>
              </div>
              {event.description ? (
                <div className="detail-item">
                  <span className="detail-item-label">Description</span>
                  <span
                    className="detail-item-value"
                    style={{ fontWeight: 400, whiteSpace: "pre-line" }}
                  >
                    {event.description}
                  </span>
                </div>
              ) : null}
              {event.image ? (
                <div className="detail-item">
                  <span className="detail-item-label">Image</span>
                  <a href={event.image} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>
                    {event.image}
                  </a>
                </div>
              ) : null}
              <div className="detail-item">
                <span className="detail-item-label">Created</span>
                <span className="detail-item-value">{formatDateTime(event.createdAt)}</span>
              </div>
            </div>

            <EventActions event={event} size="md" onChanged={query.reload} />
          </div>
        </section>

        <section className="admin-section">
          <h2 className="admin-section-title">Ticket requests</h2>
          <div className="chip-grid">
            {chipData.map((chip) => (
              <div className="chip" key={chip.label}>
                <span className="chip-value">{chip.value}</span>
                <span className="chip-label">{chip.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-event-detail-links">
            <Link to={`/admin/requests?eventId=${event.id}`} className="btn btn-secondary">
              Review requests for this event
            </Link>
            <Link to={`/admin/events/${event.id}/attendees`} className="btn btn-secondary">
              Attendees
            </Link>
            <Link to={`/admin/events/${event.id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
          </div>
        </section>

        {event.status === "DRAFT" ? (
          <Badge tone="info">This event is a draft — customers cannot see it yet.</Badge>
        ) : null}
      </div>
    </div>
  );
}
