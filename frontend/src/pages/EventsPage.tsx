import { useEffect, useState } from "react";
import { fetchEvents } from "../api/events";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import EventCard from "../components/EventCard";
import Pagination from "../components/Pagination";
import { toErrorMessage } from "../hooks/useAsyncData";
import type { Event, PagedResult } from "../types";
import "./EventsPage.css";

const PAGE_SIZE = 9;

function EventCardSkeleton() {
  return (
    <div className="event-card" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: "16 / 9", borderRadius: 0 }} />
      <div className="event-card-body">
        <div className="skeleton" style={{ height: 12, width: "40%" }} />
        <div className="skeleton" style={{ height: 18, width: "75%" }} />
        <div className="skeleton" style={{ height: 14, width: "55%" }} />
        <div className="skeleton" style={{ height: 16, width: "30%", marginTop: 12 }} />
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<Event> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce search/filter changes by 300ms; all state updates inside the
  // timer callback happen asynchronously.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents({
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((data) => {
          setResult(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(toErrorMessage(err, "Failed to load events."));
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo, page, reloadKey]);

  function handleFilterChange(updater: () => void) {
    updater();
    setPage(1);
    setLoading(true);
    setError(null);
  }

  return (
    <div className="container events-page">
      <header className="events-page-header">
        <h1 className="section-title">Browse events</h1>
        <p className="muted">Find your next gathering — request a spot in a few clicks.</p>
      </header>

      <div className="events-filters">
        <div className="field events-filter-search">
          <label htmlFor="event-search">Search</label>
          <input
            id="event-search"
            type="search"
            placeholder="Search by title or venue…"
            value={search}
            onChange={(event) =>
              handleFilterChange(() => setSearch(event.target.value))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="event-date-from">From</label>
          <input
            id="event-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) =>
              handleFilterChange(() => setDateFrom(event.target.value))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="event-date-to">To</label>
          <input
            id="event-date-to"
            type="date"
            value={dateTo}
            onChange={(event) =>
              handleFilterChange(() => setDateTo(event.target.value))
            }
          />
        </div>
      </div>

      {loading ? (
        <div className="event-grid" aria-label="Loading events">
          {Array.from({ length: 6 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
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
          message="Try adjusting your search or date filters — new events are added regularly."
        />
      ) : (
        <>
          <div className="event-grid">
            {result.items.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
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
