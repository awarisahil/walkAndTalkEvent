import { useState } from "react";
import { Link } from "react-router-dom";
import { cancelTicketRequest, fetchMyTicketRequests } from "../../api/requests";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { TicketRequest } from "../../types";
import { formatDate, formatINR } from "../../utils/format";
import "./DashboardPages.css";

export default function RequestsPage() {
  const query = useAsyncData(fetchMyTicketRequests);
  const { status, reload } = query;
  const requests = query.status === "ready" ? query.data : null;
  const [cancelTarget, setCancelTarget] = useState<TicketRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function canCancel(request: TicketRequest): boolean {
    if (request.status === "PENDING") return true;
    if (request.status === "PAYMENT_PENDING" && !request.payment) return true;
    return false;
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelTicketRequest(cancelTarget.id);
      setCancelTarget(null);
      reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Could not cancel the request.");
    } finally {
      setCancelling(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading your requests…" />
      </div>
    );
  }

  if (status === "error") {
    return <ErrorState message={query.message} onRetry={reload} />;
  }

  if (!requests || requests.length === 0) {
    return (
      <div>
        <header className="dash-page-header">
          <h1 className="dash-page-title">My requests</h1>
        </header>
        <EmptyState
          title="No requests yet"
          message="When you request tickets for events, they will show up here."
          action={
            <Link to="/events" className="btn btn-primary btn-sm">
              Browse events
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <header className="dash-page-header">
        <h1 className="dash-page-title">My requests</h1>
        <p className="muted">{requests.length} request{requests.length === 1 ? "" : "s"}</p>
      </header>

      {cancelError ? (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
          {cancelError}
        </div>
      ) : null}

      {requests.map((request) => (
        <div className="request-row" key={request.id}>
          <div className="request-row-main">
            <Link to={`/dashboard/requests/${request.id}`} className="request-row-title">
              {request.event.title}
            </Link>
            <span className="request-row-meta">
              {formatDate(request.event.date)} · {request.event.venue}
              {request.event.ticketPrice
                ? ` · ${Number(request.event.ticketPrice) === 0 ? "Free" : formatINR(request.event.ticketPrice)}`
                : ""}
            </span>
            {request.status === "REJECTED" && request.rejectionReason ? (
              <span className="request-row-meta" style={{ color: "var(--color-danger)" }}>
                Reason: {request.rejectionReason}
              </span>
            ) : null}
          </div>

          <div className="request-row-actions">
            <StatusBadge status={request.status} kind="request" />
            {request.status === "PAYMENT_PENDING" && request.payment ? (
              <Link
                to={`/dashboard/requests/${request.id}/pay`}
                className="btn btn-primary btn-sm"
              >
                Pay now
              </Link>
            ) : null}
            {canCancel(request) ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCancelTarget(request)}
              >
                Cancel request
              </button>
            ) : null}
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this request?"
        message={
          cancelTarget
            ? `Your request for "${cancelTarget.event.title}" will be cancelled. This cannot be undone.`
            : ""
        }
        confirmLabel="Cancel request"
        danger
        busy={cancelling}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
