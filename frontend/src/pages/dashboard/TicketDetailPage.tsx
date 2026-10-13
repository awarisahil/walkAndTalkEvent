import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { fetchTicket } from "../../api/tickets";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDateTime, formatINR } from "../../utils/format";
import "./DashboardPages.css";
import "./TicketDetailPage.css";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAsyncData(() => fetchTicket(id ?? ""), [id]);
  const qrToken = query.status === "ready" ? query.data.qrCode : null;

  const [qrError, setQrError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading ticket…" />
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <ErrorState
        title="Ticket unavailable"
        message={query.message}
        onRetry={query.reload}
      />
    );
  }

  const ticket = query.data;

  return (
    <div>
      <header className="dash-page-header">
        <Link to="/dashboard/tickets" className="muted" style={{ fontSize: "0.875rem" }}>
          ← Back to tickets
        </Link>
        <h1 className="dash-page-title">{ticket.event.title}</h1>
        <p className="muted">
          {formatDateTime(ticket.event.date)} · {ticket.event.venue}
        </p>
      </header>

      {ticket.usedAt ? (
        <div className="banner banner-info" role="status" style={{ marginBottom: 20 }}>
          Checked in at {formatDateTime(ticket.usedAt)}.
        </div>
      ) : null}

      <div className="card dash-card">
        <div className="detail-grid" style={{ marginBottom: 8 }}>
          <div className="detail-item">
            <span className="detail-item-label">Ticket number</span>
            <span
              className="detail-item-value"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
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
            <span className="detail-item-label">Issued on</span>
            <span className="detail-item-value">{formatDateTime(ticket.createdAt)}</span>
          </div>
          {ticket.event.ticketPrice ? (
            <div className="detail-item">
              <span className="detail-item-label">Ticket price</span>
              <span className="detail-item-value">
                {Number(ticket.event.ticketPrice) === 0
                  ? "Free"
                  : formatINR(ticket.event.ticketPrice)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="ticket-qr-wrap">
          {qrError ? (
            <p className="ticket-qr-fallback">
              Could not render the QR code. Your ticket number above is valid for entry.
            </p>
          ) : (
            <canvas
              ref={canvasRef}
              className="ticket-qr-canvas"
              aria-label="Ticket QR code"
            />
          )}
          <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center" }}>
            Present this code at the entrance. It is unique to your ticket.
          </p>
        </div>
      </div>
    </div>
  );
}
