import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  getInviteState,
  inviteDevComplete,
  invitePay,
  inviteVerify,
} from "../api/invites";
import ErrorState from "../components/ErrorState";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { useAsyncData } from "../hooks/useAsyncData";
import type { InviteState } from "../types";
import { formatDateTime, formatEventTime, formatINR } from "../utils/format";
import { loadRazorpay } from "../utils/razorpay";
import "./InvitePayPage.css";

export default function InvitePayPage() {
  const { token } = useParams<{ token: string }>();
  const query = useAsyncData(() => getInviteState(token ?? ""), [token]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (query.status === "loading") {
    return (
      <div className="invite-page">
        <div className="full-page-loading">
          <Spinner size="lg" label="Loading your invitation…" />
        </div>
        <InviteFooter />
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div className="invite-page">
        <div className="container invite-wrap">
          <ErrorState
            title="This link is not valid"
            message={`${query.message} — contact the organizer for a new link.`}
            onRetry={query.reload}
          />
        </div>
        <InviteFooter />
      </div>
    );
  }

  return (
    <div className="invite-page">
      <div className="container invite-wrap">
        <InviteBody
          token={token ?? ""}
          state={query.data}
          busy={busy}
          notice={notice}
          onNotice={setNotice}
          onBusy={setBusy}
          onChanged={query.reload}
        />
      </div>
      <InviteFooter />
    </div>
  );
}

function InviteFooter() {
  return (
    <footer className="invite-footer">
      <Link to="/">Powered by Walk &amp; Talk Events</Link>
    </footer>
  );
}

function InviteBody({
  token,
  state,
  busy,
  notice,
  onNotice,
  onBusy,
  onChanged,
}: {
  token: string;
  state: InviteState;
  busy: boolean;
  notice: string | null;
  onNotice: (message: string | null) => void;
  onBusy: (busy: boolean) => void;
  onChanged: () => void;
}) {
  const ticket = state.ticket;
  const amount = state.payment ? state.payment.amount : state.event.ticketPrice;

  // QR for the issued ticket
  const [qrError, setQrError] = useState(false);
  const [gatewayUnavailable, setGatewayUnavailable] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrToken = ticket?.qrCode ?? null;

  useEffect(() => {
    if (!qrToken || qrError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, qrToken, {
      errorCorrectionLevel: "M",
      width: 220,
      margin: 1,
    }).catch(() => setQrError(true));
  }, [qrToken, qrError]);

  async function handlePay() {
    onBusy(true);
    onNotice(null);
    try {
      const result = await invitePay(token);

      // Razorpay not configured — fall through to the dev/production notice.
      if (!result.order || !result.keyId) {
        onBusy(false);
        setGatewayUnavailable(true);
        return;
      }

      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        onNotice("Could not load the payment gateway. Check your connection and try again.");
        onBusy(false);
        return;
      }

      const razorpay = new Razorpay({
        key: result.keyId,
        order_id: result.order.id,
        amount: result.order.amount,
        currency: result.order.currency,
        name: "Walk & Talk Events",
        description: state.event.title,
        prefill: { name: state.attendee.name, email: state.attendee.email },
        theme: { color: "#795548" },
        handler: (response) => {
          void (async () => {
            try {
              await inviteVerify(token, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              onChanged();
            } catch (err) {
              onNotice(
                err instanceof Error
                  ? err.message
                  : "Payment verification failed. If you were charged, contact the organizer.",
              );
            } finally {
              onBusy(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            onNotice("Payment cancelled — your reservation is still held for now.");
            onBusy(false);
          },
        },
      });

      razorpay.on("payment.failed", () => {
        onNotice("Payment failed. Please try again.");
        onBusy(false);
      });

      razorpay.open();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Could not start the payment.");
      onBusy(false);
    }
  }

  async function handleSimulate() {
    onBusy(true);
    onNotice(null);
    try {
      await inviteDevComplete(token);
      onChanged();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      onBusy(false);
    }
  }

  const showTicket = ticket !== null || state.status === "PAID";

  return (
    <div className="card invite-card">
      <header className="invite-head">
        <p className="invite-eyebrow">You&apos;re invited</p>
        <h1 className="invite-title">{state.event.title}</h1>
        <p className="muted">
          {formatEventTime(state.event.date, state.event.startTime, state.event.endTime)} ·{" "}
          {state.event.venue}
        </p>
        <p className="muted invite-attendee">For {state.attendee.name}</p>
      </header>

      {notice ? (
        <div className="banner banner-warning" role="alert" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      ) : null}

      {showTicket && ticket ? (
        <section className="invite-section">
          <div className="banner banner-success" role="status">
            <span>You&apos;re in! Your ticket is confirmed.</span>
          </div>
          <div className="invite-ticket">
            <div className="invite-ticket-details">
              <div className="detail-item">
                <span className="detail-item-label">Ticket number</span>
                <span className="detail-item-value invite-ticket-number">
                  {ticket.ticketNumber}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Status</span>
                <span className="detail-item-value">
                  <StatusBadge status={ticket.status} kind="ticket" />
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Event</span>
                <span className="detail-item-value" style={{ fontWeight: 400 }}>
                  {formatDateTime(state.event.date)} · {state.event.venue}
                </span>
              </div>
              {ticket.usedAt ? (
                <div className="detail-item">
                  <span className="detail-item-label">Checked in</span>
                  <span className="detail-item-value" style={{ fontWeight: 400 }}>
                    {formatDateTime(ticket.usedAt)}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="invite-qr">
              {qrError ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Could not render the QR code — your ticket number above is valid for entry.
                </p>
              ) : (
                <canvas ref={canvasRef} className="invite-qr-canvas" aria-label="Ticket QR code" />
              )}
              <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>
                Present this code at the entrance.
              </p>
            </div>
          </div>
        </section>
      ) : state.status === "REJECTED" ? (
        <section className="invite-section">
          <div className="banner banner-error" role="status">
            <span>
              <strong>Your request was declined.</strong>{" "}
              {state.rejectionReason ?? "Contact the organizer for details."}
            </span>
          </div>
        </section>
      ) : state.status === "PAYMENT_PENDING" && state.reservationValid ? (
        <section className="invite-section">
          <div className="invite-amount-row">
            <span className="muted">Amount due</span>
            <span className="invite-amount">{formatINR(amount)}</span>
          </div>
          <p className="muted" style={{ marginBottom: 14, fontSize: "0.875rem" }}>
            Your spot is reserved — complete payment to secure it.
          </p>
          {gatewayUnavailable ? (
            import.meta.env.DEV ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={busy}
                onClick={() => void handleSimulate()}
              >
                {busy ? "Processing…" : "Simulate payment (development only)"}
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
              disabled={busy}
              onClick={() => void handlePay()}
            >
              {busy ? "Opening checkout…" : `Pay ${formatINR(amount)} securely`}
            </button>
          )}
        </section>
      ) : state.status === "PAYMENT_PENDING" ? (
        <section className="invite-section">
          <div className="banner banner-warning" role="status">
            <span>Your payment window expired — contact the organizer.</span>
          </div>
        </section>
      ) : (
        <section className="invite-section">
          <div className="banner banner-info" role="status">
            <span>
              Your request is being reviewed — this page will update once the
              organizer approves it.
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
