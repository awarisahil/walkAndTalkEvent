import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  approveTicketRequest,
  fetchAdminTicketRequests,
  rejectTicketRequest,
} from "../../api/requests";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { toErrorMessage } from "../../hooks/useAsyncData";
import type { AdminTicketRequest, PagedResult, TicketRequestStatus } from "../../types";
import { formatDateTime } from "../../utils/format";
import "./AdminPages.css";
import "./AdminRequestsPage.css";

const PAGE_SIZE = 10;
const DEFAULT_REJECTION_REASON = "Tickets are full, try next time.";

const STATUS_OPTIONS: Array<{ value: TicketRequestStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAYMENT_PENDING", label: "Awaiting payment" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

export default function AdminRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<TicketRequestStatus | "">(
    (searchParams.get("status") as TicketRequestStatus | null) ?? "",
  );
  const [eventFilter, setEventFilter] = useState(searchParams.get("eventId") ?? "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<AdminTicketRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [approveTarget, setApproveTarget] = useState<AdminTicketRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminTicketRequest | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync filter changes back to the URL so dashboard links stay shareable.
  function applyStatusFilter(value: TicketRequestStatus | "") {
    setStatusFilter(value);
    setPage(1);
    setLoading(true);
    setError(null);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("status", value);
    else next.delete("status");
    setSearchParams(next, { replace: true });
  }

  function clearEventFilter() {
    setEventFilter("");
    setPage(1);
    setLoading(true);
    setError(null);
    const next = new URLSearchParams(searchParams);
    next.delete("eventId");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      let cancelled = false;
      fetchAdminTicketRequests({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        eventId: eventFilter || undefined,
        search: search || undefined,
      })
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(toErrorMessage(err, "Failed to load requests."));
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 300);
    return () => clearTimeout(timer);
  }, [page, statusFilter, eventFilter, search, reloadKey]);

  function reload() {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }

  async function handleApprove() {
    if (!approveTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await approveTicketRequest(approveTarget.id);
      setApproveTarget(null);
      reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not approve this request.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject(reason: string) {
    if (!rejectTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await rejectTicketRequest(rejectTarget.id, reason);
      setRejectTarget(null);
      reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not reject this request.",
      );
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Ticket requests</h1>
        <p className="muted">Review incoming requests — approval opens payment.</p>
      </header>

      <div className="admin-toolbar">
        <div className="field admin-toolbar-search">
          <label htmlFor="admin-request-search">Search customer</label>
          <input
            id="admin-request-search"
            type="search"
            placeholder="Name or email…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              setLoading(true);
              setError(null);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-request-status">Status</label>
          <select
            id="admin-request-status"
            value={statusFilter}
            onChange={(event) =>
              applyStatusFilter(event.target.value as TicketRequestStatus | "")
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {eventFilter ? (
        <div className="banner banner-info admin-event-filter-banner" role="status">
          <span>
            Filtered to one event.{" "}
            <button type="button" className="admin-link-btn" onClick={clearEventFilter}>
              Clear event filter
            </button>
          </span>
        </div>
      ) : null}

      {actionError ? (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <div className="full-page-loading">
          <Spinner size="lg" label="Loading requests…" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No requests found"
          message="Requests matching your filters will appear here."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table admin-requests-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{request.user.name}</span>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {request.user.email}
                      </div>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {request.user.age != null ? `Age ${request.user.age}` : "Age —"}
                        {" · "}
                        {request.user.instagramUsername ? (
                          request.user.instagramProfileUrl ? (
                            <a
                              href={request.user.instagramProfileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              @{request.user.instagramUsername}
                            </a>
                          ) : (
                            <>@{request.user.instagramUsername}</>
                          )
                        ) : (
                          "no Instagram"
                        )}
                      </div>
                    </td>
                    <td>
                      {request.event.title}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {formatDateTime(request.event.date)}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={request.status} kind="request" />
                      {request.status === "REJECTED" && request.rejectionReason ? (
                        <div className="admin-request-note admin-request-note-rejected">
                          {request.rejectionReason}
                        </div>
                      ) : null}
                      {request.payment ? (
                        <div className="admin-request-note">
                          Payment:{" "}
                          <StatusBadge status={request.payment.status} kind="payment" />
                        </div>
                      ) : null}
                      {request.ticket ? (
                        <div className="admin-request-note">
                          Ticket: {request.ticket.ticketNumber}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted">{formatDateTime(request.createdAt)}</td>
                    <td>
                      {request.status === "PENDING" ? (
                        <div className="admin-request-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setActionError(null);
                              setApproveTarget(request);
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setActionError(null);
                              setRejectTarget(request);
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.meta.page}
            totalPages={result.meta.totalPages}
            total={result.meta.total}
            onPageChange={(next) => {
              setPage(next);
              setLoading(true);
              setError(null);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={approveTarget !== null}
        title="Approve this request?"
        message={
          approveTarget
            ? `${approveTarget.user.name} will be asked to pay for "${approveTarget.event.title}". Their spot is held while payment is pending.`
            : ""
        }
        confirmLabel="Approve"
        busy={actionBusy}
        onConfirm={() => void handleApprove()}
        onCancel={() => setApproveTarget(null)}
      />

      <RejectRequestDialog
        key={rejectTarget?.id ?? "closed"}
        open={rejectTarget !== null}
        request={rejectTarget}
        busy={actionBusy}
        onConfirm={(reason) => void handleReject(reason)}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}

function RejectRequestDialog({
  open,
  request,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  request: AdminTicketRequest | null;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState(DEFAULT_REJECTION_REASON);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A rejection reason is required.");
      return;
    }
    onConfirm(trimmed);
  }

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Reject request"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="dialog-title">Reject this request?</h3>
        <p className="dialog-message">
          {request
            ? `Let ${request.user.name} know why their request for "${request.event.title}" was rejected.`
            : ""}
        </p>
        <div className="field">
          <label htmlFor="reject-reason">Rejection reason</label>
          <textarea
            id="reject-reason"
            rows={3}
            value={reason}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
          {error ? <span className="field-error" role="alert">{error}</span> : null}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? "Working…" : "Reject request"}
          </button>
        </div>
      </div>
    </div>
  );
}
