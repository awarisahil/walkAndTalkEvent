import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createEvent, fetchAdminEvent, updateEvent } from "../../api/events";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { AdminEventDetail, EventInputPayload } from "../../types";
import "./EventForm.css";

interface FormState {
  title: string;
  description: string;
  image: string;
  date: string; // datetime-local value
  startTime: string;
  endTime: string;
  venue: string;
  ticketPrice: string;
  capacity: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    image: "",
    date: "",
    startTime: "",
    endTime: "",
    venue: "",
    ticketPrice: "",
    capacity: "",
  };
}

/** ISO datetime → `YYYY-MM-DDTHH:MM` in local time, for datetime-local inputs. */
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromEvent(event: AdminEventDetail): FormState {
  return {
    title: event.title,
    description: event.description ?? "",
    image: event.image ?? "",
    date: toDateTimeLocal(event.date),
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    venue: event.venue,
    ticketPrice: String(Number(event.ticketPrice)),
    capacity: String(event.capacity),
  };
}

export function AdminNewEventPage() {
  return (
    <EventFormShell
      title="Create event"
      subtitle="New events start as drafts — publish them when they are ready."
    />
  );
}

export function AdminEditEventPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAsyncData(() => fetchAdminEvent(id ?? ""), [id]);

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading event…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState message={query.message} onRetry={query.reload} />;
  }

  return (
    <EventFormShell
      title="Edit event"
      subtitle={query.data.title}
      eventId={query.data.id}
      initial={fromEvent(query.data)}
    />
  );
}

function EventFormShell({
  title,
  subtitle,
  eventId,
  initial,
}: {
  title: string;
  subtitle: string;
  eventId?: string;
  initial?: FormState;
}) {
  return (
    <div>
      <header className="admin-page-header">
        <Link
          to={eventId ? `/admin/events/${eventId}` : "/admin/events"}
          className="muted"
          style={{ fontSize: "0.875rem" }}
        >
          ← Back
        </Link>
        <h1 className="admin-page-title">{title}</h1>
        <p className="muted">{subtitle}</p>
      </header>
      <div className="card admin-card" style={{ maxWidth: 640 }}>
        <EventForm key={eventId ?? "new"} eventId={eventId} initial={initial} />
      </div>
    </div>
  );
}

function EventForm({
  eventId,
  initial,
}: {
  eventId?: string;
  initial?: FormState;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(() => initial ?? emptyForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (form.title.trim().length < 3) next.title = "Title must be at least 3 characters.";
    if (!form.date) {
      next.date = "Event date is required.";
    } else if (Number.isNaN(new Date(form.date).getTime())) {
      next.date = "Enter a valid date.";
    } else if (new Date(form.date).getTime() <= Date.now()) {
      next.date = "Event date must be in the future.";
    }
    if (form.image && !/^https?:\/\/\S+\.\S+/.test(form.image.trim()))
      next.image = "Enter a full URL starting with http:// or https://";
    if (form.venue.trim().length < 2) next.venue = "Venue is required.";
    const price = Number(form.ticketPrice);
    if (form.ticketPrice === "" || !Number.isFinite(price) || price < 0)
      next.ticketPrice = "Ticket price must be 0 or more.";
    const capacity = Number(form.capacity);
    if (form.capacity === "" || !Number.isInteger(capacity) || capacity < 1)
      next.capacity = "Capacity must be a whole number of at least 1.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    if (!validate()) return;

    const payload: EventInputPayload = {
      title: form.title.trim(),
      date: new Date(form.date).toISOString(),
      venue: form.venue.trim(),
      ticketPrice: Number(form.ticketPrice),
      capacity: Number(form.capacity),
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.image.trim()) payload.image = form.image.trim();
    if (form.startTime) payload.startTime = form.startTime;
    if (form.endTime) payload.endTime = form.endTime;

    setSaving(true);
    try {
      const saved = eventId ? await updateEvent(eventId, payload) : await createEvent(payload);
      navigate(`/admin/events/${saved.id}`);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not save the event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      {apiError ? (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
          {apiError}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="ev-title">Title</label>
        <input
          id="ev-title"
          type="text"
          value={form.title}
          aria-invalid={Boolean(errors.title)}
          onChange={(event) => update("title", event.target.value)}
        />
        {errors.title ? <span className="field-error" role="alert">{errors.title}</span> : null}
      </div>

      <div className="field">
        <label htmlFor="ev-description">
          Description <span className="muted">(optional)</span>
        </label>
        <textarea
          id="ev-description"
          rows={4}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="ev-image">
          Image URL <span className="muted">(optional)</span>
        </label>
        <input
          id="ev-image"
          type="url"
          placeholder="https://…"
          value={form.image}
          aria-invalid={Boolean(errors.image)}
          onChange={(event) => update("image", event.target.value)}
        />
        {errors.image ? <span className="field-error" role="alert">{errors.image}</span> : null}
      </div>

      <div className="event-form-grid">
        <div className="field">
          <label htmlFor="ev-date">Date</label>
          <input
            id="ev-date"
            type="datetime-local"
            value={form.date}
            aria-invalid={Boolean(errors.date)}
            onChange={(event) => update("date", event.target.value)}
          />
          {errors.date ? <span className="field-error" role="alert">{errors.date}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="ev-venue">Venue</label>
          <input
            id="ev-venue"
            type="text"
            value={form.venue}
            aria-invalid={Boolean(errors.venue)}
            onChange={(event) => update("venue", event.target.value)}
          />
          {errors.venue ? <span className="field-error" role="alert">{errors.venue}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="ev-start">
            Start time <span className="muted">(optional)</span>
          </label>
          <input
            id="ev-start"
            type="time"
            value={form.startTime}
            onChange={(event) => update("startTime", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ev-end">
            End time <span className="muted">(optional)</span>
          </label>
          <input
            id="ev-end"
            type="time"
            value={form.endTime}
            onChange={(event) => update("endTime", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ev-price">Ticket price (₹)</label>
          <input
            id="ev-price"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={form.ticketPrice}
            aria-invalid={Boolean(errors.ticketPrice)}
            onChange={(event) => update("ticketPrice", event.target.value)}
          />
          {errors.ticketPrice ? (
            <span className="field-error" role="alert">{errors.ticketPrice}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="ev-capacity">Capacity</label>
          <input
            id="ev-capacity"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={form.capacity}
            aria-invalid={Boolean(errors.capacity)}
            onChange={(event) => update("capacity", event.target.value)}
          />
          {errors.capacity ? (
            <span className="field-error" role="alert">{errors.capacity}</span>
          ) : null}
        </div>
      </div>

      <div className="event-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner size="sm" label="Saving…" /> : eventId ? "Save changes" : "Create event"}
        </button>
        <Link to={eventId ? `/admin/events/${eventId}` : "/admin/events"} className="btn btn-ghost">
          Discard
        </Link>
      </div>
    </form>
  );
}
