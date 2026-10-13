import client from "./client";
import { unwrap } from "./auth";
import type { TicketRequest } from "../types";

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
