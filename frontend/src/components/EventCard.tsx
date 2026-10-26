import { Link } from "react-router-dom";
import type { Event, TicketRequest } from "../types";
import { formatEventTime, formatINR } from "../utils/format";
import "./EventCard.css";

interface EventCardProps {
  event: Event;
  myRequest?: TicketRequest;
}

const MY_STATUS_BADGE: Partial<
  Record<TicketRequest["status"], { label: string; tone: string }>
> = {
  PAID: { label: "Ticket secured", tone: "success" },
  PAYMENT_PENDING: { label: "Awaiting payment", tone: "info" },
  PENDING: { label: "Requested", tone: "warning" },
  REJECTED: { label: "Declined", tone: "danger" },
};

export default function EventCard({ event, myRequest }: EventCardProps) {
  const price = Number(event.ticketPrice);
  const isAlmostFull = event.available > 0 && event.available < 10;
  const myBadge = myRequest
    ? MY_STATUS_BADGE[myRequest.status]
    : undefined;

  return (
    <Link to={`/events/${event.id}`} className="event-card">
      {event.image ? (
        <div className="event-card-image">
          <img src={event.image} alt="" loading="lazy" />
        </div>
      ) : (
        <div
          className="event-card-image event-card-image-placeholder"
          aria-hidden="true"
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
      )}

      {myBadge ? (
        <span className={`event-card-my-badge badge badge-${myBadge.tone}`}>
          {myBadge.label}
        </span>
      ) : null}

      <div className="event-card-body">
        <p className="event-card-date">{formatEventTime(event.date, event.startTime, event.endTime)}</p>
        <h3 className="event-card-title">{event.title}</h3>
        <p className="event-card-venue">{event.venue}</p>

        <div className="event-card-footer">
          <span className="event-card-price">
            {price === 0 ? "Free" : formatINR(event.ticketPrice)}
          </span>
          {event.available === 0 ? (
            <span className="badge badge-neutral">Sold out</span>
          ) : isAlmostFull ? (
            <span className="badge badge-highlight">Only {event.available} left</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
