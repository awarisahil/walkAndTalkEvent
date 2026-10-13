import { useEffect, useState } from "react";
import { fetchAdminPayments } from "../../api/payments";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { toErrorMessage } from "../../hooks/useAsyncData";
import type { AdminPayment, PagedResult, PaymentStatus } from "../../types";
import { formatDateTime, formatINR } from "../../utils/format";
import "./AdminPages.css";
import "./AdminPaymentsPage.css";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ value: PaymentStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "SUCCESS", label: "Successful" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

export default function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PagedResult<AdminPayment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let cancelled = false;
      fetchAdminPayments({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        search: search || undefined,
      })
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(toErrorMessage(err, "Failed to load payments."));
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 300);
    return () => clearTimeout(timer);
  }, [page, statusFilter, search, reloadKey]);

  function handleFilterChange(updater: () => void) {
    updater();
    setPage(1);
    setLoading(true);
    setError(null);
  }

  return (
    <div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Payments</h1>
        <p className="muted">All payments across events, newest first.</p>
      </header>

      <div className="admin-toolbar">
        <div className="field admin-toolbar-search">
          <label htmlFor="admin-payment-search">Search customer</label>
          <input
            id="admin-payment-search"
            type="search"
            placeholder="Name or email…"
            value={search}
            onChange={(event) => handleFilterChange(() => setSearch(event.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-payment-status">Status</label>
          <select
            id="admin-payment-status"
            value={statusFilter}
            onChange={(event) =>
              handleFilterChange(() => setStatusFilter(event.target.value as PaymentStatus | ""))
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="full-page-loading">
          <Spinner size="lg" label="Loading payments…" />
        </div>
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No payments found"
          message="Payments matching your filters will appear here."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Order reference</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{payment.user.name}</span>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {payment.user.email}
                      </div>
                    </td>
                    <td>
                      {payment.event.title}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {formatDateTime(payment.event.date)}
                      </div>
                    </td>
                    <td>{formatINR(payment.amount)}</td>
                    <td>
                      <StatusBadge status={payment.status} kind="payment" />
                    </td>
                    <td className="muted">{payment.provider}</td>
                    <td
                      className="muted"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8rem", wordBreak: "break-all" }}
                    >
                      {payment.providerOrderId ?? "—"}
                    </td>
                    <td className="muted">{formatDateTime(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.meta.page}
            totalPages={result.meta.totalPages}
            total={result.meta.total}
            onPageChange={(next) => {
              setPage(next);
              setLoading(true);
              setError(null);
            }}
          />
        </>
      )}
    </div>
  );
}
