import type { Response } from "express";

export function ok<T>(
  res: Response,
  data: T,
  options?: { message?: string; status?: number },
) {
  const body: Record<string, unknown> = { success: true, data };
  if (options?.message) body.message = options.message;
  return res.status(options?.status ?? 200).json(body);
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export function parsePagination(query: unknown): Pagination {
  const q = (query ?? {}) as Record<string, unknown>;
  const rawPage = Number(q.page);
  const rawPageSize = Number(q.pageSize);

  const page =
    Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const pageSize =
    Number.isInteger(rawPageSize) &&
    rawPageSize >= 1 &&
    rawPageSize <= 100
      ? rawPageSize
      : 10;

  return { page, pageSize };
}

export function paged<T>(items: T[], total: number, p: Pagination): PagedResult<T> {
  return {
    items,
    meta: {
      total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
    },
  };
}

export function searchTerm(query: unknown): string | undefined {
  const q = (query ?? {}) as Record<string, unknown>;
  const raw = q.search;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
