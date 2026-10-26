import client from "./client";
import { unwrap } from "./auth";
import type { CheckInResult, Ticket, TicketLookupResult } from "../types";

export async function fetchMyTickets(): Promise<Ticket[]> {
  const res = await client.get("/tickets/my");
  return unwrap<Ticket[]>(res);
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const res = await client.get(`/tickets/${id}`);
  return unwrap<Ticket>(res);
}

/* ---------- admin ---------- */

export async function lookupTicket(
  ticketNumber: string,
  eventId?: string,
): Promise<TicketLookupResult> {
  const res = await client.get("/tickets/lookup", {
    params: { ticketNumber, eventId: eventId || undefined },
  });
  return unwrap<TicketLookupResult>(res);
}

export async function checkInTicket(
  ticketNumber: string,
  eventId?: string,
): Promise<CheckInResult> {
  const res = await client.post("/tickets/check-in", {
    ticketNumber,
    eventId: eventId || undefined,
  });
  return unwrap<CheckInResult>(res);
}

/** Direct check-in by the opaque QR token (what ticket QR codes encode). */
export async function checkInTicketByQr(
  qrToken: string,
  eventId?: string,
): Promise<CheckInResult> {
  const res = await client.post("/tickets/check-in", {
    qrToken,
    eventId: eventId || undefined,
  });
  return unwrap<CheckInResult>(res);
}
