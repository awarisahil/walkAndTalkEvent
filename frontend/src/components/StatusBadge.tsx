import Badge, { type BadgeTone } from "./Badge";
import type {
  EventStatus,
  PaymentStatus,
  TicketRequestStatus,
  TicketStatus,
} from "../types";

const REQUEST_STATUS_MAP: Record<TicketRequestStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
  PAYMENT_PENDING: { label: "Awaiting payment", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

const PAYMENT_STATUS_MAP: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "info" },
  SUCCESS: { label: "Successful", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

const TICKET_STATUS_MAP: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  USED: { label: "Used", tone: "violet" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

const EVENT_STATUS_MAP: Record<EventStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "violet" },
};

type StatusKind = "request" | "payment" | "ticket" | "event";

interface StatusBadgeProps {
  status: string;
  kind: StatusKind;
}

export default function StatusBadge({ status, kind }: StatusBadgeProps) {
  const map: Record<string, { label: string; tone: BadgeTone }> =
    kind === "request"
      ? REQUEST_STATUS_MAP
      : kind === "payment"
        ? PAYMENT_STATUS_MAP
        : kind === "ticket"
          ? TICKET_STATUS_MAP
          : EVENT_STATUS_MAP;

  const entry = map[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
