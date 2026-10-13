const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Formats a serialized Prisma Decimal / number / numeric string as ₹. */
export function formatINR(value: string | number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "₹0";
  return inrFormatter.format(num);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Event time label combining the event date with optional explicit
 * start/end time strings returned by the API (e.g. "18:00").
 */
export function formatEventTime(
  dateIso: string,
  startTime?: string | null,
  endTime?: string | null,
): string {
  const datePart = formatDate(dateIso);
  const parts: string[] = [];
  if (startTime) parts.push(startTime);
  if (endTime && endTime !== startTime) parts.push(endTime);
  return parts.length > 0 ? `${datePart} · ${parts.join(" – ")}` : datePart;
}

export function formatEventDateTime(iso: string | null | undefined): string {
  return formatDateTime(iso);
}
