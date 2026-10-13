import { Link } from "react-router-dom";
import { fetchEvents } from "../api/events";
import EventCard from "../components/EventCard";
import ErrorState from "../components/ErrorState";
import Spinner from "../components/Spinner";
import { useAsyncData } from "../hooks/useAsyncData";
import { useMyRequestStatuses } from "../hooks/useMyRequestStatuses";
import "./LandingPage.css";

export default function LandingPage() {
  const query = useAsyncData(() =>
    fetchEvents({ page: 1, pageSize: 6 }).then((result) => result.items),
  );
  const myRequests = useMyRequestStatuses();
  const { status, reload } = query;
  const events = query.status === "ready" ? query.data : null;

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

        {status === "loading" ? (
          <div className="full-page-loading">
            <Spinner size="lg" label="Loading events…" />
          </div>
        ) : status === "error" ? (
          <ErrorState message={query.message} onRetry={reload} />
        ) : !events || events.length === 0 ? null : (
          <div className="event-grid">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                myRequest={myRequests?.get(event.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
