import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchEvent } from "../api/events";
import { createTicketRequest } from "../api/requests";
import { ApiError } from "../api/client";
import Badge from "../components/Badge";
import ErrorState from "../components/ErrorState";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/useAuth";
import { useAsyncData } from "../hooks/useAsyncData";
import { useMyRequestStatuses } from "../hooks/useMyRequestStatuses";
import { formatDateTime, formatEventTime, formatINR } from "../utils/format";
import "./EventDetailPage.css";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const query = useAsyncData(() => fetchEvent(id ?? ""), [id]);
  const myRequests = useMyRequestStatuses();

  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [alreadyRequested, setAlreadyRequested] = useState(false);

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading event…" />
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div className="container event-detail-page">
        <ErrorState
          title="Event unavailable"
          message={query.message}
          onRetry={query.reload}
        />
      </div>
    );
  }

  const event = query.data;

  const price = Number(event.ticketPrice);
  const soldOut = event.available === 0;
  const myRequest =
    user?.role === "CUSTOMER" ? myRequests?.get(event.id) : undefined;

  async function handleRequest() {
    setRequesting(true);
    setRequestError(null);
    try {
      await createTicketRequest(event.id);
      navigate("/dashboard/requests");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyRequested(true);
      } else {
        setRequestError(
          err instanceof Error ? err.message : "Could not submit your request.",
        );
      }
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="event-detail-page">
      {event.image ? (
        <div className="event-detail-hero">
          <img src={event.image} alt={event.title} />
        </div>
      ) : (
        <div className="event-detail-hero event-detail-hero-placeholder" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
      )}

      <div className="container event-detail-body">
        <div className="event-detail-main">
          <p className="event-detail-kicker">
            {formatEventTime(event.date, event.startTime, event.endTime)}
          </p>
          <h1 className="event-detail-title">{event.title}</h1>
          <p className="event-detail-venue">{event.venue}</p>

          {event.description ? (
            <section className="event-detail-section">
              <h2>About this event</h2>
              <p className="event-detail-description">{event.description}</p>
            </section>
          ) : null}

          <section className="event-detail-section">
            <h2>Availability</h2>
            <p className="muted">
              {soldOut
                ? "This event is fully booked."
                : `${event.available} of ${event.capacity} spots left`}
            </p>
          </section>
        </div>

        <aside className="event-detail-aside">
          <div className="card event-cta-card">
            <div className="event-cta-price">
              {price === 0 ? "Free" : formatINR(event.ticketPrice)}
            </div>
            <p className="event-cta-meta muted">
              {formatDateTime(event.date)} · {event.venue}
            </p>

            {authLoading ? (
              <Spinner label="Checking session…" />
            ) : !user ? (
              <>
                <Link to="/login" className="btn btn-primary btn-block">
                  Log in to request a ticket
                </Link>
                <p className="event-cta-note muted">
                  New here?{" "}
                  <Link to="/register">Create an account</Link> to request a spot.
                </p>
              </>
            ) : user.role === "ADMIN" ? (
              <p className="event-cta-note muted">
                You are signed in as an organizer. Admins cannot request tickets.
              </p>
            ) : myRequest?.status === "PAID" ? (
              <div className="banner banner-success">
                <span>
                  You have a ticket for this event.{" "}
                  {myRequest.ticket ? (
                    <Link to={`/dashboard/tickets/${myRequest.ticket.id}`}>
                      View your ticket
                    </Link>
                  ) : (
                    <Link to="/dashboard/tickets">View your tickets</Link>
                  )}
                </span>
              </div>
            ) : myRequest?.status === "PAYMENT_PENDING" ? (
              <div className="banner banner-info">
                <span>
                  Your request was approved — complete your payment to secure
                  the spot.{" "}
                  <Link to={`/dashboard/requests/${myRequest.id}/pay`}>
                    Pay now
                  </Link>
                </span>
              </div>
            ) : myRequest?.status === "PENDING" ? (
              <div className="banner banner-info">
                <span>
                  Your request is being reviewed.{" "}
                  <Link to="/dashboard/requests">View your requests</Link>.
                </span>
              </div>
            ) : myRequest?.status === "REJECTED" ? (
              <div className="banner banner-error">
                <span>
                  Your request was declined.
                  {myRequest.rejectionReason
                    ? ` Reason: ${myRequest.rejectionReason}`
                    : ""}
                </span>
              </div>
            ) : myRequest?.status === "CANCELLED" ||
              myRequest?.status === "EXPIRED" ? (
              <div className="banner banner-neutral">
                <span>
                  Your previous request for this event was closed. Only one
                  request per event is allowed — contact the organizer for help.
                </span>
              </div>
            ) : soldOut ? (
              <Badge tone="neutral">Tickets full</Badge>
            ) : alreadyRequested ? (
              <div className="banner banner-info">
                <span>
                  You have already requested a ticket for this event.{" "}
                  <Link to="/dashboard/requests">View your requests</Link>.
                </span>
              </div>
            ) : (
              <>
                {requestError ? (
                  <div className="banner banner-error" role="alert">
                    {requestError}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={requesting}
                  onClick={() => void handleRequest()}
                >
                  {requesting ? "Submitting…" : "Request ticket"}
                </button>
                <p className="event-cta-note muted">
                  Your request is reviewed before payment. No charge until approved.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
