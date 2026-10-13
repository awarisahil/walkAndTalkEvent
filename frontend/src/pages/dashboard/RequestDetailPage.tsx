import { Link, useParams } from "react-router-dom";
import { fetchTicketRequest } from "../../api/requests";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDateTime, formatINR } from "../../utils/format";
import "./DashboardPages.css";

interface TimelineStep {
  key: string;
  title: string;
  state: "done" | "current" | "rejected" | "upcoming";
  meta?: string;
}

function buildTimeline(request: {
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      key: "submitted",
      title: "Request submitted",
      state: "done",
      meta: formatDateTime(request.createdAt),
    },
  ];

  if (request.status === "PENDING") {
    steps.push({
      key: "review",
      title: "Under review",
      state: "current",
      meta: "The organizer is reviewing your request.",
    });
    return steps;
  }

  if (request.status === "REJECTED") {
    steps.push({
      key: "reviewed",
      title: "Request reviewed",
      state: "done",
      meta: request.reviewedAt ? `Reviewed ${formatDateTime(request.reviewedAt)}` : undefined,
    });
    steps.push({
      key: "rejected",
      title: "Request rejected",
      state: "rejected",
      meta: request.rejectionReason ? `Reason: ${request.rejectionReason}` : undefined,
    });
    return steps;
  }

  // PAYMENT_PENDING / PAID / CANCELLED / EXPIRED all passed review.
  steps.push({
    key: "reviewed",
    title: "Request approved",
    state: "done",
    meta: request.reviewedAt ? `Reviewed ${formatDateTime(request.reviewedAt)}` : undefined,
  });

  if (request.status === "PAYMENT_PENDING") {
    steps.push({
      key: "payment",
      title: "Awaiting payment",
      state: "current",
      meta: "Complete payment to secure your spot.",
    });
  } else if (request.status === "PAID") {
    steps.push({ key: "payment", title: "Payment completed", state: "done" });
    steps.push({ key: "ticket", title: "Ticket issued", state: "done" });
  } else if (request.status === "EXPIRED") {
    steps.push({ key: "expired", title: "Reservation expired", state: "rejected" });
  } else if (request.status === "CANCELLED") {
    steps.push({ key: "cancelled", title: "Request cancelled", state: "rejected" });
  }
  return steps;
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAsyncData(() => fetchTicketRequest(id ?? ""), [id]);
  const { status, reload } = query;
  const request = query.status === "ready" ? query.data : null;

  if (status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading request…" />
      </div>
    );
  }

  if (status === "error" || !request) {
    return (
      <ErrorState
        title="Request unavailable"
        message={status === "error" ? query.message : "This request could not be found."}
        onRetry={reload}
      />
    );
  }

  const steps = buildTimeline(request);

  return (
    <div>
      <header className="dash-page-header">
        <Link to="/dashboard/requests" className="muted" style={{ fontSize: "0.875rem" }}>
          ← Back to requests
        </Link>
        <h1 className="dash-page-title">{request.event.title}</h1>
        <p className="muted">
          {formatDateTime(request.event.date)} · {request.event.venue}
        </p>
      </header>

      {request.status === "REJECTED" && request.rejectionReason ? (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 20 }}>
          <span>
            <strong>Your request was rejected.</strong> {request.rejectionReason}
          </span>
        </div>
      ) : null}

      <div className="dash-section">
        <div className="card dash-card detail-grid">
          <div className="detail-item">
            <span className="detail-item-label">Status</span>
            <span className="detail-item-value">
              <StatusBadge status={request.status} kind="request" />
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Ticket price</span>
            <span className="detail-item-value">
              {Number(request.event.ticketPrice) === 0
                ? "Free"
                : formatINR(request.event.ticketPrice)}
            </span>
          </div>
          {request.payment ? (
            <div className="detail-item">
              <span className="detail-item-label">Payment</span>
              <span className="detail-item-value">
                <StatusBadge status={request.payment.status} kind="payment" />{" "}
                {formatINR(request.payment.amount)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <section className="dash-section">
        <h2 className="dash-section-title">Progress</h2>
        <div className="card dash-card">
          <ol className="timeline" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {steps.map((step, index) => (
              <li
                key={step.key}
                className={`timeline-step is-${step.state}`}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                <span className="timeline-dot">
                  {step.state === "done" ? "✓" : index + 1}
                </span>
                <div className="timeline-content">
                  <span className="timeline-title">{step.title}</span>
                  {step.meta ? <span className="timeline-meta">{step.meta}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {request.status === "PAYMENT_PENDING" && request.payment ? (
        <section className="dash-section">
          <Link
            to={`/dashboard/requests/${request.id}/pay`}
            className="btn btn-primary"
          >
            Complete payment
          </Link>
        </section>
      ) : null}

      {request.ticket ? (
        <section className="dash-section">
          <h2 className="dash-section-title">Your ticket</h2>
          <div className="card dash-card">
            <p style={{ marginBottom: 12 }}>
              Ticket <strong>{request.ticket.ticketNumber}</strong>{" "}
              <StatusBadge status={request.ticket.status} kind="ticket" />
            </p>
            <Link to={`/dashboard/tickets/${request.ticket.id}`} className="btn btn-secondary btn-sm">
              View ticket
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
