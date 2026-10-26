import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getInviteState, inviteUpiQr } from "../api/invites";
import { ApiError } from "../api/client";
import Spinner from "./Spinner";
import { formatINR } from "../utils/format";
import "./UpiQrPay.css";

type UpiPhase = "idle" | "loading" | "shown";

interface UpiQrPayProps {
  token: string;
  amount: string;
  /** Called once the invite state confirms PAID (parent re-fetches). */
  onPaid: () => void;
}

/**
 * On-page UPI payment: renders a Razorpay payment-link QR the attendee scans
 * with any UPI app, then polls the invite until the payment lands.
 */
export default function UpiQrPay({ token, amount, onPaid }: UpiQrPayProps) {
  const [phase, setPhase] = useState<UpiPhase>("idle");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render the QR once the link exists.
  useEffect(() => {
    if (!qrUrl || qrError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, qrUrl, {
      errorCorrectionLevel: "M",
      width: 220,
      margin: 1,
    }).catch(() => setQrError(true));
  }, [qrUrl, qrError]);

  // Poll while the QR is shown; stop on PAID / error / unmount.
  useEffect(() => {
    if (phase !== "shown") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const state = await getInviteState(token);
          if (cancelled) return;
          if (state.ticket || state.status === "PAID") {
            clearInterval(timer);
            onPaid();
          }
        } catch (err) {
          if (cancelled) return;
          clearInterval(timer);
          setError(
            err instanceof ApiError && err.status === 404
              ? "This payment link expired — ask the organizer for a new one."
              : "Stopped watching for payment — refresh to try again.",
          );
        }
      })();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, token, onPaid]);

  async function handleShowQr() {
    setPhase("loading");
    setError(null);
    try {
      const result = await inviteUpiQr(token);
      setQrUrl(result.qrUrl);
      setPhase("shown");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not prepare the UPI QR.");
    }
  }

  function handleCancel() {
    setPhase("idle");
    setQrUrl(null);
    setError(null);
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <div className="upi-qr">
        {error ? (
          <div className="banner banner-warning" role="alert">
            {error}
          </div>
        ) : null}
        <div className="upi-qr-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={phase === "loading"}
          onClick={() => void handleShowQr()}
        >
          {phase === "loading" ? (
            <Spinner size="sm" label="Preparing QR…" />
          ) : (
            "Pay with UPI QR"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="upi-qr">
      {error ? (
        <div className="banner banner-warning" role="alert">
          {error}
        </div>
      ) : null}
      <div className="upi-qr-divider" aria-hidden="true">
        <span>or</span>
      </div>

      <div className="card upi-qr-card">
        {qrError ? (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Could not render the QR —{" "}
            <a href={qrUrl ?? "#"} target="_blank" rel="noreferrer">
              open the payment link
            </a>{" "}
            instead.
          </p>
        ) : (
          <canvas ref={canvasRef} className="upi-qr-canvas" aria-label="UPI payment QR code" />
        )}
        <p className="upi-qr-brand">Walk &amp; Talk</p>
        <p className="upi-qr-amount">
          Pay {formatINR(amount)} to Walk &amp; Talk Events
        </p>
        <p className="muted upi-qr-hint">
          Scan with any UPI app — GPay, PhonePe, Paytm. This page confirms
          automatically once the payment completes.
        </p>
        <button type="button" className="upi-qr-cancel" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
