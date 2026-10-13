import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminEvents } from "../../api/events";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { toErrorMessage } from "../../hooks/useAsyncData";
import type { Event, EventStatus, PagedResult } from "../../types";
import { formatDate, formatINR } from "../../utils/format";
import EventActions from "./EventActions";
import "./AdminPages.css";
import "./AdminEventsPage.css";

const PAGE_SIZE = 10;

export default function AdminEventsPage() {
  const [statusFilter, setStatusFilter] = useState<EventStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<Event> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let cancelled = false;
      fetchAdminEvents({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        search: search || undefined,
      })
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(toErrorMessage(err, "Failed to load events."));
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 300);
    return () => clearTimeout(timer);
  }, [page, statusFilter, search, reloadKey]);

  function handleFilterChange(updater: () => void) {
    updater();
    setPage(1);
    setLoading(true);
    setError(null);
  }

  return (
    <div>
      <header className="admin-page-header admin-events-header">
        <div>
          <h1 className="admin-page-title">Events</h1>
          <p className="muted">Create, publish and manage all events.</p>
        </div>
        <Link to="/admin/events/new" className="btn btn-primary">
          Create event
        </Link>
      </header>

      <div className="admin-events-toolbar">
        <div className="field admin-events-search">
          <label htmlFor="admin-event-search">Search</label>
          <input
            id="admin-event-search"
            type="search"
            placeholder="Search by title or venue…"
            value={search}
            onChange={(event) => handleFilterChange(() => setSearch(event.target.value))}
          />
        </div>
        <div className="field admin-events-status">
          <label htmlFor="admin-status-filter">Status</label>
          <select
            id="admin-status-filter"
            value={statusFilter}
            onChange={(event) =>
              handleFilterChange(() => setStatusFilter(event.target.value as EventStatus | ""))
            }
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="full-page-loading">
          <Spinner size="lg" label="Loading events…" />
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
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No events found"
          message={
            search || statusFilter
              ? "Try adjusting your search or status filter."
              : "Create your first event to get started."
          }
          action={
            <Link to="/admin/events/new" className="btn btn-primary btn-sm">
              Create event
            </Link>
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Price</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Link
                        to={`/admin/events/${event.id}`}
                        style={{ fontWeight: 600, color: "var(--color-text)" }}
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td>{formatDate(event.date)}</td>
                    <td>{event.venue}</td>
                    <td>
                      {Number(event.ticketPrice) === 0
                        ? "Free"
                        : formatINR(event.ticketPrice)}
                    </td>
                    <td className="muted">
                      {event.occupied}/{event.capacity} taken · {event.available} left
                    </td>
                    <td>
                      <StatusBadge status={event.status} kind="event" />
                    </td>
                    <td className="muted">{formatDate(event.createdAt)}</td>
                    <td>
                      <EventActions
                        event={event}
                        onChanged={() => {
                          setLoading(true);
                          setError(null);
                          setReloadKey((k) => k + 1);
                        }}
                      />
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
    </div>
  );
}
