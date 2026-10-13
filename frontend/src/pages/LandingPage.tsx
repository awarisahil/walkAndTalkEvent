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
        <svg
          className="landing-hero-trail"
          viewBox="0 0 1200 90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          <path d="M0 70C150 30 300 88 450 58s300-52 450-22 220 8 300-18" strokeDasharray="2 12" />
          <ellipse cx="320" cy="62" rx="5" ry="8" transform="rotate(-14 320 62)" />
          <ellipse cx="342" cy="66" rx="5" ry="8" transform="rotate(-14 342 66)" />
          <ellipse cx="820" cy="40" rx="5" ry="8" transform="rotate(10 820 40)" />
          <ellipse cx="842" cy="38" rx="5" ry="8" transform="rotate(10 842 38)" />
        </svg>
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
          </div>
        </div>
      </section>

      <section className="landing-events container">
        <div className="landing-events-header">
          <h2 className="section-title">
            <svg
              className="section-title-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21c-4.5-2.5-7-6-7-10a7 7 0 0 1 14 0c0 4-2.5 7.5-7 10z" />
              <path d="M12 3v18" strokeDasharray="1 4" />
            </svg>
            Upcoming events
          </h2>
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
