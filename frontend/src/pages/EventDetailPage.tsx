import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { fetchEvent } from "../api/events";
import { guestJoin } from "../api/requests";
import { getInviteState, inviteDevComplete, invitePay, inviteVerify } from "../api/invites";
import { ApiError } from "../api/client";
import Badge from "../components/Badge";
import ErrorState from "../components/ErrorState";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { useAsyncData } from "../hooks/useAsyncData";
import type { Event, InviteState } from "../types";
import { formatDateTime, formatEventTime, formatINR } from "../utils/format";
import { loadRazorpay } from "../utils/razorpay";
import "./EventDetailPage.css";

/* ---------- same-browser invite token storage ---------- */

const joinKey = (eventId: string) => `wt_join_${eventId}`;

function readJoinToken(eventId: string): string | null {
  try {
    return localStorage.getItem(joinKey(eventId));
  } catch {
    return null;
  }
}

function saveJoinToken(eventId: string, token: string): void {
  try {
    localStorage.setItem(joinKey(eventId), token);
  } catch {
    // storage unavailable — the status view still works for this session
  }
}

function clearJoinToken(eventId: string): void {
  try {
    localStorage.removeItem(joinKey(eventId));
  } catch {
    // ignore
  }
}

function isTerminal(state: InviteState): boolean {
  if (["PAID", "REJECTED", "CANCELLED", "EXPIRED"].includes(state.status)) return true;
  return state.status === "PAYMENT_PENDING" && !state.reservationValid;
}

/* ---------- page ---------- */

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAsyncData(() => fetchEvent(id ?? ""), [id]);

  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(() =>
    id ? readJoinToken(id) : null,
  );

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

  function handleJoined(token: string | null) {
    if (token) {
      saveJoinToken(event.id, token);
      setInviteToken(token);
      // Switch straight to the live status view ("being reviewed" first).
      setJoinOpen(false);
    }
    // No token returned: leave the modal open on its success state.
  }

  function handleDetach() {
    clearJoinToken(event.id);
    setInviteToken(null);
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

            {inviteToken ? (
              <JoinStatusCard
                key={inviteToken}
                event={event}
                inviteToken={inviteToken}
                onDetach={handleDetach}
              />
            ) : soldOut ? (
              <Badge tone="neutral">Tickets full</Badge>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => setJoinOpen(true)}
                >
                  Request to Join
                </button>
                <p className="event-cta-note muted">
                  No account needed. Your request is reviewed before payment —
                  this page turns into your ticket once you&apos;re in.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      {joinOpen ? (
        <JoinEventModal
          key={event.id}
          eventId={event.id}
          eventTitle={event.title}
          onSuccess={handleJoined}
          onClose={() => setJoinOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ---------- status-aware CTA (invite token present) ---------- */

function JoinStatusCard({
  event,
  inviteToken,
  onDetach,
}: {
  event: Event;
  inviteToken: string;
  onDetach: () => void;
}) {
  const [state, setState] = useState<InviteState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [gatewayUnavailable, setGatewayUnavailable] = useState(false);

  // High-frequency mutable flags read by the polling loop.
  const modalOpenRef = useRef(false);
  const terminalRef = useRef(false);

  const load = useCallback(async (): Promise<InviteState | null> => {
    try {
      const next = await getInviteState(inviteToken);
      setState(next);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      return null;
    }
  }, [inviteToken]);

  // Initial fetch + 8s polling. Stops on terminal states, unmount, and
  // pauses while the Razorpay modal is open.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      if (modalOpenRef.current) {
        timer = setTimeout(() => void tick(), 4000);
        return;
      }
      const next = await load();
      if (cancelled) return;
      if (next && isTerminal(next)) {
        terminalRef.current = true;
        return;
      }
      timer = setTimeout(() => void tick(), 8000);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (notFound) onDetach();
  }, [notFound, onDetach]);

  // Ticket QR
  const [qrError, setQrError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrToken = state?.ticket?.qrCode ?? null;

  useEffect(() => {
    if (!qrToken || qrError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, qrToken, {
      errorCorrectionLevel: "M",
      width: 200,
      margin: 1,
    }).catch(() => setQrError(true));
  }, [qrToken, qrError]);

  async function handlePay() {
    setPayBusy(true);
    setNotice(null);
    try {
      const result = await invitePay(inviteToken);

      if (!result.order || !result.keyId) {
        setPayBusy(false);
        setGatewayUnavailable(true);
        return;
      }

      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setNotice("Could not load the payment gateway. Check your connection and try again.");
        setPayBusy(false);
        return;
      }

      modalOpenRef.current = true;
      const razorpay = new Razorpay({
        key: result.keyId,
        order_id: result.order.id,
        amount: result.order.amount,
        currency: result.order.currency,
        name: "Walk & Talk Events",
        description: event.title,
        prefill: state
          ? { name: state.attendee.name, email: state.attendee.email }
          : undefined,
        theme: { color: "#795548" },
        handler: (response) => {
          void (async () => {
            try {
              await inviteVerify(inviteToken, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              await load();
            } catch (err) {
              setNotice(
                err instanceof Error
                  ? err.message
                  : "Payment verification failed. If you were charged, contact the organizer.",
              );
            } finally {
              modalOpenRef.current = false;
              setPayBusy(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            modalOpenRef.current = false;
            setNotice("Payment cancelled — your reservation is still held for now.");
            setPayBusy(false);
          },
        },
      });

      razorpay.on("payment.failed", () => {
        modalOpenRef.current = false;
        setNotice("Payment failed. Please try again.");
        setPayBusy(false);
      });

      razorpay.open();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start the payment.");
      setPayBusy(false);
    }
  }

  async function handleSimulate() {
    setPayBusy(true);
    setNotice(null);
    try {
      await inviteDevComplete(inviteToken);
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <div className="join-status">
      {state === null ? (
        <p className="join-status-checking muted">
          <Spinner size="sm" /> Checking status…
        </p>
      ) : (
        <JoinStatusBody
          state={state}
          event={event}
          notice={notice}
          payBusy={payBusy}
          gatewayUnavailable={gatewayUnavailable}
          onPay={() => void handlePay()}
          onSimulate={() => void handleSimulate()}
          canvasRef={canvasRef}
          qrError={qrError}
        />
      )}

      <button type="button" className="join-status-detach" onClick={onDetach}>
        Not your request? Remove from this device
      </button>
    </div>
  );
}

function JoinStatusBody({
  state,
  event,
  notice,
  payBusy,
  gatewayUnavailable,
  onPay,
  onSimulate,
  canvasRef,
  qrError,
}: {
  state: InviteState;
  event: Event;
  notice: string | null;
  payBusy: boolean;
  gatewayUnavailable: boolean;
  onPay: () => void;
  onSimulate: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  qrError: boolean;
}) {
  const amount = state.payment ? state.payment.amount : event.ticketPrice;

  return (
    <>
      {notice ? (
        <div className="banner banner-warning" role="alert">
          {notice}
        </div>
      ) : null}

      {state.ticket || state.status === "PAID" ? (
        state.ticket ? (
          <div className="join-ticket">
            <div className="banner banner-success" role="status">
              <span>You&apos;re in!</span>
            </div>
            <p className="join-ticket-number">{state.ticket.ticketNumber}</p>
            <div className="join-ticket-qr">
              {qrError ? (
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  QR unavailable — your ticket number is valid for entry.
                </p>
              ) : (
                <canvas ref={canvasRef} className="join-ticket-canvas" aria-label="Ticket QR code" />
              )}
            </div>
            <div className="join-ticket-meta">
              <StatusBadge status={state.ticket.status} kind="ticket" />
              <span className="muted">
                {formatDateTime(event.date)} · {event.venue}
              </span>
              {state.ticket.usedAt ? (
                <span className="muted">Checked in {formatDateTime(state.ticket.usedAt)}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="banner banner-success" role="status">
            <span>You&apos;re in! Your ticket is being issued…</span>
          </div>
        )
      ) : state.status === "PENDING" ? (
        <div className="banner banner-info" role="status">
          <span>Your request is being reviewed — this page updates automatically.</span>
        </div>
      ) : state.status === "PAYMENT_PENDING" && state.reservationValid ? (
        <>
          <div className="join-amount-row">
            <span className="muted">Amount due</span>
            <span className="join-amount">{formatINR(amount)}</span>
          </div>
          <p className="event-cta-note muted">
            Your spot is reserved — complete payment to secure it.
          </p>
          {gatewayUnavailable ? (
            import.meta.env.DEV ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={payBusy}
                onClick={onSimulate}
              >
                {payBusy ? "Processing…" : "Simulate payment (development only)"}
              </button>
            ) : (
              <div className="banner banner-info" role="status">
                Online payments are not enabled yet — please contact the organizer.
              </div>
            )
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={payBusy}
              onClick={onPay}
            >
              {payBusy ? "Opening checkout…" : `Pay ${formatINR(amount)} securely`}
            </button>
          )}
        </>
      ) : state.status === "PAYMENT_PENDING" ? (
        <div className="banner banner-warning" role="status">
          <span>Your payment window has expired — please contact the organizer.</span>
        </div>
      ) : state.status === "REJECTED" ? (
        <div className="banner banner-error" role="status">
          <span>
            <strong>Your request was declined.</strong>{" "}
            {state.rejectionReason ?? "Contact the organizer for details."}
          </span>
        </div>
      ) : (
        <div className="banner banner-neutral" role="status">
          <span>
            This request is no longer active ({state.status.toLowerCase()}) — contact the
            organizer for help.
          </span>
        </div>
      )}
    </>
  );
}

/* ---------- Request to Join modal (no-token state) ---------- */

interface JoinFormState {
  name: string;
  email: string;
  phone: string;
  instagram: string;
  linkedin: string;
  age: string;
}

type JoinFormErrors = Partial<Record<keyof JoinFormState, string>>;

const EMPTY_FORM: JoinFormState = {
  name: "",
  email: "",
  phone: "",
  instagram: "",
  linkedin: "",
  age: "",
};

/**
 * Splits the "What is your Instagram profile?" answer into the username and
 * profile URL parts the API expects: full URLs keep the URL and take the
 * username from the path; bare handles just get @ stripped.
 */
function splitInstagram(value: string): { instagramUsername: string; instagramProfileUrl?: string } {
  const trimmed = value.trim().replace(/^@+/, "");
  if (/^https?:\/\//i.test(trimmed) || /instagram\.com\//i.test(trimmed)) {
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const username = segments.find((segment) => !["p", "reel", "reels", "accounts"].includes(segment));
    return {
      instagramUsername: (username ?? "").replace(/^@/, ""),
      instagramProfileUrl: url,
    };
  }
  return { instagramUsername: trimmed };
}

function JoinEventModal({
  eventId,
  eventTitle,
  onSuccess,
  onClose,
}: {
  eventId: string;
  eventTitle: string;
  onSuccess: (inviteToken: string | null) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<JoinFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<JoinFormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function update(field: keyof JoinFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setApiError(null);
  }

  function validate(): boolean {
    const next: JoinFormErrors = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    const phone = form.phone.trim();
    if (phone.length < 10 || phone.length > 15) {
      next.phone = "Phone number must be 10–15 characters.";
    }
    if (form.instagram.trim().replace(/^@+/, "").length < 2) {
      next.instagram = "Instagram profile is required.";
    }
    if (form.linkedin.trim() && !/^https?:\/\/\S+\.\S+/.test(form.linkedin.trim())) {
      next.linkedin = "Enter a full URL starting with http:// or https://";
    }
    if (form.age) {
      const age = Number(form.age);
      if (!Number.isInteger(age) || age < 18 || age > 100) {
        next.age = "You must be between 18 and 100 years old.";
      }
    } else {
      next.age = "Your age is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    if (!validate()) return;

    const instagram = splitInstagram(form.instagram);
    if (instagram.instagramUsername.length < 2) {
      setErrors((prev) => ({ ...prev, instagram: "Enter a valid Instagram username or profile URL." }));
      return;
    }

    setSubmitting(true);
    try {
      const result = await guestJoin({
        eventId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        instagramUsername: instagram.instagramUsername,
        ...(instagram.instagramProfileUrl
          ? { instagramProfileUrl: instagram.instagramProfileUrl }
          : {}),
        ...(form.linkedin.trim() ? { linkedinProfileUrl: form.linkedin.trim() } : {}),
        age: Number(form.age),
      });
      setSubmitted(true);
      onSuccess(result.inviteToken ?? null);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="join-modal-backdrop" onClick={onClose}>
      <div
        className="join-modal card"
        role="dialog"
        aria-modal="true"
        aria-label={`Request to join ${eventTitle}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="join-modal-head">
          <h2 className="join-modal-title">Request to Join</h2>
          <button type="button" className="join-modal-close" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="muted join-modal-sub">{eventTitle}</p>

        {submitted ? (
          <div className="join-modal-success">
            <div className="banner banner-success" role="status">
              <span>
                <strong>Request submitted!</strong> We&apos;ll email you once it&apos;s
                reviewed.
              </span>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            {apiError ? (
              <div className="banner banner-error" role="alert" style={{ marginBottom: 14 }}>
                {apiError}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="join-name">Name <span className="field-required" aria-hidden="true">*</span></label>
              <input
                id="join-name"
                type="text"
                autoComplete="name"
                value={form.name}
                aria-invalid={Boolean(errors.name)}
                onChange={(event) => update("name", event.target.value)}
              />
              {errors.name ? <span className="field-error" role="alert">{errors.name}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="join-email">Email <span className="field-required" aria-hidden="true">*</span></label>
              <input
                id="join-email"
                type="email"
                autoComplete="email"
                value={form.email}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => update("email", event.target.value)}
              />
              {errors.email ? <span className="field-error" role="alert">{errors.email}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="join-phone">Phone Number <span className="field-required" aria-hidden="true">*</span></label>
              <input
                id="join-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                aria-invalid={Boolean(errors.phone)}
                onChange={(event) => update("phone", event.target.value)}
              />
              {errors.phone ? <span className="field-error" role="alert">{errors.phone}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="join-instagram">What is your Instagram profile? <span className="field-required" aria-hidden="true">*</span></label>
              <input
                id="join-instagram"
                type="text"
                placeholder="@username or profile URL"
                value={form.instagram}
                aria-invalid={Boolean(errors.instagram)}
                onChange={(event) => update("instagram", event.target.value)}
              />
              {errors.instagram ? (
                <span className="field-error" role="alert">{errors.instagram}</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="join-linkedin">
                What is your LinkedIn profile? <span className="muted">(optional)</span>
              </label>
              <input
                id="join-linkedin"
                type="url"
                placeholder="https://www.linkedin.com/in/…"
                value={form.linkedin}
                aria-invalid={Boolean(errors.linkedin)}
                onChange={(event) => update("linkedin", event.target.value)}
              />
              {errors.linkedin ? (
                <span className="field-error" role="alert">{errors.linkedin}</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="join-age">Your Age <span className="field-required" aria-hidden="true">*</span></label>
              <input
                id="join-age"
                type="number"
                min={18}
                max={100}
                inputMode="numeric"
                value={form.age}
                aria-invalid={Boolean(errors.age)}
                onChange={(event) => update("age", event.target.value)}
              />
              {errors.age ? <span className="field-error" role="alert">{errors.age}</span> : null}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? "Submitting…" : "Request to Join"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
