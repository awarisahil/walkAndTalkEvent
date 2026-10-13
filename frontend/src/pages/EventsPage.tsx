import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEvents } from "../api/events";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import EventCard from "../components/EventCard";
import Pagination from "../components/Pagination";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    (params: { search: string; dateFrom: string; dateTo: string; page: number }) => {
      setLoading(true);
      setError(null);
      fetchEvents({
        search: params.search || undefined,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
        page: params.page,
        pageSize: PAGE_SIZE,
      })
        .then(setResult)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to load events.");
        })
        .finally(() => setLoading(false));
    },
    [],
  );

  // Debounce search input by 300ms; dates and page changes load immediately.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load({ search, dateFrom, dateTo, page });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, dateFrom, dateTo, page, load]);

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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="event-date-from">From</label>
          <input
            id="event-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="event-date-to">To</label>
          <input
            id="event-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
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
          onRetry={() => load({ search, dateFrom, dateTo, page })}
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
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
