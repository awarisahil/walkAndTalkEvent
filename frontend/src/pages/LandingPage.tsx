import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchEvents } from "../api/events";
import EventCard from "../components/EventCard";
import ErrorState from "../components/ErrorState";
import Spinner from "../components/Spinner";
import type { Event } from "../types";
import "./LandingPage.css";

export default function LandingPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEvents({ page: 1, pageSize: 6 })
      .then((result) => {
        if (!cancelled) setEvents(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="container landing-hero-inner">
          <p className="landing-hero-eyebrow">Walk &amp; Talk Events</p>
          <h1 className="landing-hero-title">
            Gatherings worth
            <br />
            showing up for.
          </h1>
          <p className="landing-hero-subcopy">
            Discover curated walks, talks and community events near you.
            Request a spot in seconds — we handle the rest.
          </p>
          <div className="landing-hero-actions">
            <Link to="/events" className="btn btn-primary">
              Browse events
            </Link>
            <Link to="/register" className="btn btn-secondary">
              Create account
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-events container">
        <div className="landing-events-header">
          <h2 className="section-title">Upcoming events</h2>
          <Link to="/events" className="landing-events-viewall">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="full-page-loading">
            <Spinner size="lg" label="Loading events…" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : events.length === 0 ? null : (
          <div className="event-grid">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
