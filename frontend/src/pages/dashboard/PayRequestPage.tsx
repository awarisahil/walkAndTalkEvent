import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  completePaymentDev,
  createPayment,
  createRazorpayOrder,
  fetchPaymentConfig,
  verifyPayment,
} from "../../api/payments";
import { fetchTicketRequest } from "../../api/requests";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useAuth } from "../../context/useAuth";
import { toErrorMessage } from "../../hooks/useAsyncData";
import type { PaymentConfig, PaymentFulfillment, TicketRequest } from "../../types";
import { formatDateTime, formatINR } from "../../utils/format";
import { loadRazorpay } from "../../utils/razorpay";
import "./DashboardPages.css";

type PayPhase =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "ready"; request: TicketRequest; config: PaymentConfig }
  | { step: "success"; fulfillment: PaymentFulfillment };

export default function PayRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [phase, setPhase] = useState<PayPhase>({ step: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [request, config] = await Promise.all([
          fetchTicketRequest(id),
          fetchPaymentConfig(),
        ]);
        if (!cancelled) setPhase({ step: "ready", request, config });
      } catch (err) {
        if (!cancelled) {
          setPhase({
            step: "error",
            message: toErrorMessage(err, "Failed to load payment details."),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  function reload() {
    setPhase({ step: "loading" });
    setReloadKey((k) => k + 1);
  }

  async function handlePay() {
    if (phase.step !== "ready") return;
    const { request } = phase;
    setBusy(true);
    setNotice(null);
    try {
      const payment = await createPayment(request.id);
      const orderData = await createRazorpayOrder(payment.id);

      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setNotice("Could not load the payment gateway. Check your connection and try again.");
        setBusy(false);
        return;
      }

      const razorpay = new Razorpay({
        key: orderData.keyId,
        order_id: orderData.order.id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Walk & Talk Events",
        description: request.event.title,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#795548" },
        handler: (response) => {
          void (async () => {
            try {
              const fulfillment = await verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              setPhase({ step: "success", fulfillment });
            } catch (err) {
              setNotice(
                err instanceof Error
                  ? err.message
                  : "Payment verification failed. If you were charged, contact the organizer.",
              );
            } finally {
              setBusy(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setNotice("Payment cancelled — your reservation is still held for now.");
            setBusy(false);
          },
        },
      });

      razorpay.on("payment.failed", () => {
        setNotice("Payment failed. Please try again.");
        setBusy(false);
      });

      razorpay.open();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start the payment.");
      setBusy(false);
    }
  }

  async function handleSimulate() {
    if (phase.step !== "ready") return;
    setBusy(true);
    setNotice(null);
    try {
      const payment = await createPayment(phase.request.id);
      const fulfillment = await completePaymentDev(payment.id);
      setPhase({ step: "success", fulfillment });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  if (phase.step === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Preparing payment…" />
      </div>
    );
  }

  if (phase.step === "error") {
    return <ErrorState message={phase.message} onRetry={reload} />;
  }

  if (phase.step === "success") {
    const { fulfillment } = phase;
    return (
      <div>
        <header className="dash-page-header">
          <h1 className="dash-page-title">Payment successful</h1>
          <p className="muted">
            {fulfillment.alreadyProcessed
              ? "This payment was already processed — here is your ticket."
              : "Your ticket is confirmed. See you there!"}
          </p>
        </header>
        <div className="card dash-card">
          <div className="detail-grid" style={{ marginBottom: 20 }}>
            <div className="detail-item">
              <span className="detail-item-label">Amount paid</span>
              <span className="detail-item-value">
                {formatINR(fulfillment.payment.amount)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Status</span>
              <span className="detail-item-value">{fulfillment.payment.status}</span>
            </div>
            {fulfillment.ticket ? (
              <div className="detail-item">
                <span className="detail-item-label">Ticket number</span>
                <span className="detail-item-value">{fulfillment.ticket.ticketNumber}</span>
              </div>
            ) : null}
          </div>
          {fulfillment.ticket ? (
            <Link to={`/dashboard/tickets/${fulfillment.ticket.id}`} className="btn btn-primary">
              View your ticket
            </Link>
          ) : (
            <Link to="/dashboard/tickets" className="btn btn-primary">
              Go to my tickets
            </Link>
          )}
        </div>
      </div>
    );
  }

  const { request, config } = phase;
  const amount = request.payment ? request.payment.amount : request.event.ticketPrice;

  return (
    <div>
      <header className="dash-page-header">
        <Link to="/dashboard/requests" className="muted" style={{ fontSize: "0.875rem" }}>
          ← Back to requests
        </Link>
        <h1 className="dash-page-title">Complete your payment</h1>
        <p className="muted">
          {request.event.title} · {formatDateTime(request.event.date)}
        </p>
      </header>

      <div className="card dash-card" style={{ maxWidth: 560 }}>
        <div className="detail-grid" style={{ marginBottom: 20 }}>
          <div className="detail-item">
            <span className="detail-item-label">Event</span>
            <span className="detail-item-value">{request.event.title}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Venue</span>
            <span className="detail-item-value">{request.event.venue}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Amount due</span>
            <span className="detail-item-value" style={{ fontSize: "1.4rem" }}>
              {formatINR(amount)}
            </span>
          </div>
        </div>

        {notice ? (
          <div className="banner banner-warning" role="alert" style={{ marginBottom: 16 }}>
            {notice}
          </div>
        ) : null}

        {config.razorpayEnabled ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void handlePay()}
          >
            {busy ? "Opening checkout…" : `Pay ${formatINR(amount)} — UPI or card`}
          </button>
        ) : import.meta.env.DEV ? (
          <>
            <div className="banner banner-info" role="status" style={{ marginBottom: 16 }}>
              Online payments are not configured for this environment.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void handleSimulate()}
            >
              {busy ? "Processing…" : "Simulate payment (development only)"}
            </button>
          </>
        ) : (
          <div className="banner banner-info" role="status">
            Online payments are not enabled yet; your reservation is held for 30
            minutes — please contact the organizer.
          </div>
        )}
      </div>
    </div>
  );
}
