import "./Pagination.css";

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p += 1) {
    pages.push(p);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Prev
      </button>
      <div className="pagination-pages">
        {pages[0] > 1 ? (
          <>
            <button
              type="button"
              className="pagination-page"
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {pages[0] > 2 ? <span className="pagination-ellipsis">…</span> : null}
          </>
        ) : null}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`pagination-page${p === page ? " is-current" : ""}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages ? (
          <>
            {pages[pages.length - 1] < totalPages - 1 ? (
              <span className="pagination-ellipsis">…</span>
            ) : null}
            <button
              type="button"
              className="pagination-page"
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </button>
          </>
        ) : null}
      </div>
      <button
        type="button"
        className="pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
