import { Link, useParams } from "react-router-dom";
import { fetchPayment } from "../../api/payments";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDateTime, formatINR } from "../../utils/format";
import "./DashboardPages.css";

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAsyncData(() => fetchPayment(id ?? ""), [id]);
  const { status, reload } = query;
  const payment = query.status === "ready" ? query.data : null;

  if (status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading payment…" />
      </div>
    );
  }

  if (status === "error" || !payment) {
    return (
      <ErrorState
        title="Payment unavailable"
        message={status === "error" ? query.message : "This payment could not be found."}
        onRetry={reload}
      />
    );
  }

  return (
    <div>
      <header className="dash-page-header">
        <Link to="/dashboard/payments" className="muted" style={{ fontSize: "0.875rem" }}>
          ← Back to payments
        </Link>
        <h1 className="dash-page-title">Payment details</h1>
      </header>

      <div className="card dash-card">
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-item-label">Event</span>
            <span className="detail-item-value">{payment.event.title}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Venue</span>
            <span className="detail-item-value">{payment.event.venue}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Amount</span>
            <span className="detail-item-value">{formatINR(payment.amount)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Status</span>
            <span className="detail-item-value">
              <StatusBadge status={payment.status} kind="payment" />
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Provider</span>
            <span className="detail-item-value">{payment.provider}</span>
          </div>
          {payment.providerOrderId ? (
            <div className="detail-item">
              <span className="detail-item-label">Order reference</span>
              <span className="detail-item-value" style={{ wordBreak: "break-all" }}>
                {payment.providerOrderId}
              </span>
            </div>
          ) : null}
          <div className="detail-item">
            <span className="detail-item-label">Paid on</span>
            <span className="detail-item-value">{formatDateTime(payment.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
