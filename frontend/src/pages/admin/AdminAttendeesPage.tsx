import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { exportAttendeesCsv, fetchAttendees } from "../../api/events";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { toErrorMessage } from "../../hooks/useAsyncData";
import type { AttendeesResponse } from "../../types";
import { formatDateTime } from "../../utils/format";
import "./AdminPages.css";
import "./AdminAttendeesPage.css";

const PAGE_SIZE = 10;

export default function AdminAttendeesPage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AttendeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const timer = setTimeout(() => {
      let cancelled = false;
      fetchAttendees(id, {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
      })
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(toErrorMessage(err, "Failed to load attendees."));
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 300);
    return () => clearTimeout(timer);
  }, [id, page, search, statusFilter, reloadKey]);

  function handleFilterChange(updater: () => void) {
    updater();
    setPage(1);
    setLoading(true);
    setError(null);
  }

  async function handleExport() {
    if (!id) return;
    setExporting(true);
    setExportError(null);
    try {
      const csv = await exportAttendeesCsv(id);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `attendees-${id}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (!id) return null;

  return (
    <div>
      <header className="admin-page-header">
        <Link to={`/admin/events/${id}`} className="muted" style={{ fontSize: "0.875rem" }}>
          ← Back to event
        </Link>
        <div className="admin-attendees-head">
          <div>
            <h1 className="admin-page-title">Attendees</h1>
            <p className="muted">Checked-in and confirmed ticket holders.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </header>

      {exportError ? (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
          {exportError}
        </div>
      ) : null}

      {loading ? (
        <div className="full-page-loading">
          <Spinner size="lg" label="Loading attendees…" />
        </div>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : !data ? null : (
        <>
          <div className="stat-grid">
            <div className="card stat-card">
              <span className="stat-card-value">{data.stats.capacity}</span>
              <span className="stat-card-label">Capacity</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-value">{data.stats.reserved}</span>
              <span className="stat-card-label">Reserved</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-value">{data.stats.confirmed}</span>
              <span className="stat-card-label">Confirmed</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-value">{data.stats.used}</span>
              <span className="stat-card-label">Checked in</span>
            </div>
            <div className="card stat-card">
              <span className="stat-card-value">{data.stats.remaining}</span>
              <span className="stat-card-label">Remaining</span>
            </div>
          </div>

          <div className="admin-toolbar">
            <div className="field admin-toolbar-search">
              <label htmlFor="attendee-search">Search</label>
              <input
                id="attendee-search"
                type="search"
                placeholder="Ticket number, name or email…"
                value={search}
                onChange={(event) => handleFilterChange(() => setSearch(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="attendee-status">Status</label>
              <select
                id="attendee-status"
                value={statusFilter}
                onChange={(event) => handleFilterChange(() => setStatusFilter(event.target.value))}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="USED">Used</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {data.result.items.length === 0 ? (
            <EmptyState
              title="No attendees found"
              message="Tickets that are purchased for this event will appear here."
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Purchased</th>
                      <th>Checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.result.items.map((attendee) => (
                      <tr key={attendee.id}>
                        <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }}>
                          {attendee.ticketNumber}
                        </td>
                        <td style={{ fontWeight: 600 }}>{attendee.user.name}</td>
                        <td>{attendee.user.email}</td>
                        <td className="muted">{attendee.user.phone ?? "—"}</td>
                        <td>
                          <StatusBadge status={attendee.status} kind="ticket" />
                        </td>
                        <td className="muted">{formatDateTime(attendee.createdAt)}</td>
                        <td className="muted">
                          {attendee.usedAt ? formatDateTime(attendee.usedAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.result.meta.page}
                totalPages={data.result.meta.totalPages}
                total={data.result.meta.total}
                onPageChange={(next) => {
                  setPage(next);
                  setLoading(true);
                  setError(null);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
