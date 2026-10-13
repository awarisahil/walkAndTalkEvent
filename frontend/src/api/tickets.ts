import client from "./client";
import { unwrap } from "./auth";
import type { Ticket } from "../types";

export async function fetchMyTickets(): Promise<Ticket[]> {
  const res = await client.get("/tickets/my");
  return unwrap<Ticket[]>(res);
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const res = await client.get(`/tickets/${id}`);
  return unwrap<Ticket>(res);
}
