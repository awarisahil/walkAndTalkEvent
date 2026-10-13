import client from "./client";
import { unwrap } from "./auth";
import type {
  AdminTicketRequest,
  PagedResult,
  TicketRequest,
  TicketRequestStatus,
} from "../types";

export async function createTicketRequest(eventId: string): Promise<TicketRequest> {
  const res = await client.post("/ticket-requests", { eventId });
  return unwrap<TicketRequest>(res);
}

export async function fetchMyTicketRequests(): Promise<TicketRequest[]> {
  const res = await client.get("/ticket-requests/my");
  return unwrap<TicketRequest[]>(res);
}

export async function fetchMyPaymentPendingRequests(): Promise<TicketRequest[]> {
  const res = await client.get("/ticket-requests/my/payment-pending");
  return unwrap<TicketRequest[]>(res);
}

export async function fetchTicketRequest(id: string): Promise<TicketRequest> {
  const res = await client.get(`/ticket-requests/${id}`);
  return unwrap<TicketRequest>(res);
}

export async function cancelTicketRequest(id: string): Promise<TicketRequest> {
  const res = await client.patch(`/ticket-requests/${id}/cancel`);
  return unwrap<TicketRequest>(res);
}

/* ---------- admin ---------- */

export async function fetchAdminTicketRequests(params: {
  search?: string;
  eventId?: string;
  status?: TicketRequestStatus;
  page?: number;
  pageSize?: number;
} = {}): Promise<PagedResult<AdminTicketRequest>> {
  const res = await client.get("/ticket-requests/admin", { params });
  return unwrap<PagedResult<AdminTicketRequest>>(res);
}

export async function approveTicketRequest(id: string): Promise<AdminTicketRequest> {
  const res = await client.patch(`/ticket-requests/${id}/approve`);
  return unwrap<AdminTicketRequest>(res);
}

export async function rejectTicketRequest(
  id: string,
  rejectionReason: string,
): Promise<AdminTicketRequest> {
  const res = await client.patch(`/ticket-requests/${id}/reject`, { rejectionReason });
  return unwrap<AdminTicketRequest>(res);
}
