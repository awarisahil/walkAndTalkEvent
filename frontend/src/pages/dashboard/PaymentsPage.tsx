import { Link, useNavigate } from "react-router-dom";
import { fetchMyPayments } from "../../api/payments";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDateTime, formatINR } from "../../utils/format";
import "./DashboardPages.css";

export default function PaymentsPage() {
  const navigate = useNavigate();
  const query = useAsyncData(fetchMyPayments);

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading payments…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState message={query.message} onRetry={query.reload} />;
  }

  const payments = query.data;

  return (
    <div>
      <header className="dash-page-header">
        <h1 className="dash-page-title">Payments</h1>
        <p className="muted">Every payment you have made, newest first.</p>
      </header>

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="Payments for approved ticket requests will appear here."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  onClick={() => navigate(`/dashboard/payments/${payment.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <Link
                      to={`/dashboard/payments/${payment.id}`}
                      onClick={(event) => event.stopPropagation()}
                      style={{ fontWeight: 600, color: "var(--color-text)" }}
                    >
                      {payment.event.title}
                    </Link>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {formatDateTime(payment.event.date)}
                    </div>
                  </td>
                  <td>{formatINR(payment.amount)}</td>
                  <td>
                    <StatusBadge status={payment.status} kind="payment" />
                  </td>
                  <td className="muted">{formatDateTime(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
