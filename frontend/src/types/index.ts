export type Role = "ADMIN" | "CUSTOMER";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  age: number | null;
  instagramUsername: string | null;
  instagramProfileUrl: string | null;
  role: Role;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

export interface Event {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string;
  /** Serialized Prisma Decimal — always parse with Number() before formatting. */
  ticketPrice: string;
  capacity: number;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  occupied: number;
  available: number;
}

export interface EventListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PagedResult<T> {
  items: T[];
  meta: EventListMeta;
}

export interface RequestCounts {
  pending: number;
  paymentPending: number;
  paid: number;
  rejected: number;
  cancelled: number;
  expired: number;
}

export interface AdminEventDetail extends Event {
  requestCounts: RequestCounts;
}

export type TicketRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export type TicketStatus = "ACTIVE" | "USED" | "CANCELLED";

export interface EventSummary {
  id: string;
  title: string;
  description?: string | null;
  image?: string | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  venue: string;
  ticketPrice: string;
  capacity?: number;
  status?: EventStatus;
}

export interface PaymentSummary {
  id: string;
  status: PaymentStatus;
  amount: string;
  provider?: string;
  createdAt?: string;
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
}

export interface TicketRequest {
  id: string;
  status: TicketRequestStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  event: EventSummary;
  payment?: PaymentSummary | null;
  ticket?: TicketSummary | null;
}

export interface Payment {
  id: string;
  amount: string;
  status: PaymentStatus;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
    ticketPrice?: string;
  };
  ticketRequest: { id: string; status: TicketRequestStatus };
}

export interface PaymentConfig {
  razorpayEnabled: boolean;
  razorpayKeyId: string | null;
}

export interface RazorpayOrderResponse {
  order: { id: string; amount: number; currency: string };
  keyId: string;
  paymentId: string;
}

export interface PaymentFulfillment {
  payment: { id: string; amount: string; status: PaymentStatus };
  ticket: {
    id: string;
    ticketNumber: string;
    status: TicketStatus;
    qrCode?: string;
    createdAt?: string;
  } | null;
  alreadyProcessed: boolean;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  qrCode: string;
  usedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  event: EventSummary;
  ticketRequest: { id: string; status: TicketRequestStatus };
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code?: string;
  errors?: unknown;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  age?: number;
  instagramUsername?: string;
  instagramProfileUrl?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string | null;
  age?: number | null;
  instagramUsername?: string | null;
  instagramProfileUrl?: string | null;
}

export interface EventQueryParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/* ---------- admin domain ---------- */

export interface AdminTicketRequest extends TicketRequest {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    age: number | null;
    instagramUsername: string | null;
    instagramProfileUrl: string | null;
  };
}

export interface EventInputPayload {
  title: string;
  description?: string;
  image?: string;
  /** ISO 8601 datetime. */
  date: string;
  startTime?: string;
  endTime?: string;
  venue: string;
  ticketPrice: number;
  capacity: number;
}

export interface Attendee {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  createdAt: string;
  usedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

export interface AttendeeStats {
  capacity: number;
  reserved: number;
  confirmed: number;
  used: number;
  remaining: number;
}

export interface AttendeesResponse {
  stats: AttendeeStats;
  result: PagedResult<Attendee>;
}

export interface AdminPayment extends Payment {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TicketLookupResult {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  createdAt: string;
  usedAt: string | null;
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CheckInResult {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  usedAt: string;
  event: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

/* ---------- community ---------- */

export type CommunityMediaType = "PHOTO" | "VIDEO" | "INSTAGRAM";

export interface CommunityPost {
  id: string;
  mediaType: CommunityMediaType;
  mediaUrl: string;
  caption: string | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
  } | null;
}

export interface CreateCommunityPostPayload {
  mediaType: CommunityMediaType;
  mediaUrl: string;
  caption?: string;
  eventId?: string;
}

/** Response of POST /community/upload — a same-origin "/uploads/..." path. */
export interface CommunityUploadResponse {
  url: string;
}
