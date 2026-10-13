import { Link } from "react-router-dom";
import { fetchMyPaymentPendingRequests } from "../../api/requests";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDate, formatINR } from "../../utils/format";
import "./DashboardPages.css";

export default function AwaitingPaymentPage() {
  const query = useAsyncData(fetchMyPaymentPendingRequests);

  if (query.status === "loading") {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" label="Loading…" />
      </div>
    );
  }

  if (query.status === "error") {
    return <ErrorState message={query.message} onRetry={query.reload} />;
  }

  const requests = query.data;

  return (
    <div>
      <header className="dash-page-header">
        <h1 className="dash-page-title">Awaiting payment</h1>
        <p className="muted">
          Your spot is reserved — complete payment before the hold expires.
        </p>
      </header>

      {requests.length === 0 ? (
        <EmptyState
          title="Nothing awaiting payment"
          message="Approved requests that need payment will appear here."
        />
      ) : (
        requests.map((request) => (
          <div className="request-row" key={request.id}>
            <div className="request-row-main">
              <Link to={`/dashboard/requests/${request.id}`} className="request-row-title">
                {request.event.title}
              </Link>
              <span className="request-row-meta">
                {formatDate(request.event.date)} · {request.event.venue}
                {request.payment ? ` · ${formatINR(request.payment.amount)}` : ""}
              </span>
            </div>
            <div className="request-row-actions">
              <Link
                to={`/dashboard/requests/${request.id}/pay`}
                className="btn btn-primary btn-sm"
              >
                Pay now
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
