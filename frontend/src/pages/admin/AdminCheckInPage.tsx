import { useState, type FormEvent } from "react";
import { checkInTicket, lookupTicket } from "../../api/tickets";
import { fetchAdminEvents } from "../../api/events";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { CheckInResult, Event, TicketLookupResult } from "../../types";
import { formatDateTime } from "../../utils/format";
import QrScanner from "./QrScanner";
import "./AdminPages.css";
import "./AdminCheckInPage.css";

export default function AdminCheckInPage() {
  const eventsQuery = useAsyncData(async () => {
    const result = await fetchAdminEvents({ page: 1, pageSize: 100 });
    return result.items
      .filter((event) => event.status === "PUBLISHED" || event.status === "COMPLETED")
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  const [ticketNumber, setTicketNumber] = useState("");
  const [eventId, setEventId] = useState("");
  const [lookupResult, setLookupResult] = useState<TicketLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<CheckInResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const scannerSupported =
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  async function runLookup(number: string, selectedEventId: string) {
    setLookingUp(true);
    setLookupError(null);
    setCheckInError(null);
    setCheckInSuccess(null);
    try {
      const result = await lookupTicket(number, selectedEventId || undefined);
      setLookupResult(result);
    } catch (err) {
      setLookupResult(null);
      setLookupError(err instanceof Error ? err.message : "Ticket not found.");
    } finally {
      setLookingUp(false);
    }
  }

  function handleLookupSubmit(event: FormEvent) {
    event.preventDefault();
    const number = ticketNumber.trim();
    if (!number) {
      setLookupError("Enter a ticket number.");
      return;
    }
    void runLookup(number, eventId);
  }

  async function handleCheckIn() {
    if (!lookupResult) return;
    setCheckingIn(true);
    setCheckInError(null);
    setCheckInSuccess(null);
    try {
      const result = await checkInTicket(lookupResult.ticketNumber, eventId || undefined);
      setCheckInSuccess(result);
      setLookupResult((prev) =>
        prev ? { ...prev, status: "USED", usedAt: result.usedAt } : prev,
      );
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  }

  function handleScanned(value: string) {
    setScanning(false);
    setTicketNumber(value);
    void runLookup(value, eventId);
  }

  return (
    <div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Check-in</h1>
        <p className="muted">Verify tickets at the door — search by number or scan a QR code.</p>
      </header>

      <div className="checkin-columns">
        <section className="card admin-card checkin-panel">
          <h2 className="admin-section-title">Manual entry</h2>

          <div className="field">
            <label htmlFor="checkin-event">Event filter (optional)</label>
            <select
              id="checkin-event"
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              disabled={eventsQuery.status !== "ready"}
            >
              <option value="">All events</option>
              {eventsQuery.status === "ready"
                ? eventsQuery.data.map((event: Event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} · {formatDateTime(event.date)}
                    </option>
                  ))
                : null}
            </select>
            <span className="field-hint">
              Restricts lookup and check-in to one event. Leave blank to search everywhere.
            </span>
          </div>

          <form onSubmit={handleLookupSubmit} className="checkin-form">
            <div className="field checkin-ticket-field">
              <label htmlFor="checkin-ticket">Ticket number</label>
              <input
                id="checkin-ticket"
                type="text"
                placeholder="e.g. TKT-XXXX-XXXX"
                value={ticketNumber}
                onChange={(event) => setTicketNumber(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary checkin-lookup-btn"
              disabled={lookingUp}
            >
              {lookingUp ? "Looking up…" : "Find ticket"}
            </button>
          </form>

          {lookupError ? (
            <div className="banner banner-error" role="alert" style={{ marginTop: 16 }}>
              {lookupError}
            </div>
          ) : null}

          {lookupResult ? (
            <div className="checkin-result" aria-live="polite">
              <div className="checkin-result-head">
                <div>
                  <span className="checkin-result-number">{lookupResult.ticketNumber}</span>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {lookupResult.event.title} · {formatDateTime(lookupResult.event.date)}
                  </div>
                </div>
                <StatusBadge status={lookupResult.status} kind="ticket" />
              </div>
              <div className="detail-grid" style={{ marginBottom: 16 }}>
                <div className="detail-item">
                  <span className="detail-item-label">Holder</span>
                  <span className="detail-item-value">{lookupResult.user.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Email</span>
                  <span className="detail-item-value">{lookupResult.user.email}</span>
                </div>
                {lookupResult.usedAt ? (
                  <div className="detail-item">
                    <span className="detail-item-label">Checked in</span>
                    <span className="detail-item-value">
                      {formatDateTime(lookupResult.usedAt)}
                    </span>
                  </div>
                ) : null}
              </div>

              {checkInError ? (
                <div className="banner banner-error" role="alert" style={{ marginBottom: 12 }}>
                  {checkInError}
                </div>
              ) : null}

              {lookupResult.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={checkingIn}
                  onClick={() => void handleCheckIn()}
                >
                  {checkingIn ? "Checking in…" : "Check in"}
                </button>
              ) : (
                <p className="muted" style={{ fontSize: "0.875rem" }}>
                  {lookupResult.status === "USED"
                    ? "This ticket has already been used."
                    : "This ticket is cancelled and cannot be used."}
                </p>
              )}
            </div>
          ) : lookingUp ? (
            <div style={{ marginTop: 16 }}>
              <Spinner label="Looking up ticket…" />
            </div>
          ) : null}
        </section>

        <section className="card admin-card checkin-panel">
          <h2 className="admin-section-title">Scan QR code</h2>
          {scannerError ? (
            <div className="banner banner-warning" role="alert" style={{ marginBottom: 12 }}>
              {scannerError}
            </div>
          ) : null}

          {!scannerSupported ? (
            <p className="muted">
              Camera scanning is not supported in this browser — use manual entry.
            </p>
          ) : !scanning ? (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                Point the camera at a ticket's QR code. The scanned code fills the ticket
                number and looks it up automatically.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setScannerError(null);
                  setScanning(true);
                }}
              >
                Scan QR
              </button>
            </>
          ) : (
            <QrScanner
              onScan={handleScanned}
              onError={(message) => {
                setScannerError(message);
                setScanning(false);
              }}
              onClose={() => setScanning(false)}
            />
          )}
        </section>
      </div>

      {checkInSuccess ? (
        <div className="banner banner-success checkin-success" role="status">
          <span>
            <strong>{checkInSuccess.ticketNumber}</strong> checked in for "
            {checkInSuccess.event.title}" — {checkInSuccess.user.name} ·{" "}
            {formatDateTime(checkInSuccess.usedAt)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
