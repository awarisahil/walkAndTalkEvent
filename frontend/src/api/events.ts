import client from "./client";
import { unwrap } from "./auth";
import type {
  AdminEventDetail,
  Event,
  EventQueryParams,
  EventStatus,
  PagedResult,
} from "../types";

export async function fetchEvents(params: EventQueryParams = {}): Promise<PagedResult<Event>> {
  const res = await client.get("/events", { params });
  return unwrap<PagedResult<Event>>(res);
}

export async function fetchEvent(id: string): Promise<Event> {
  const res = await client.get(`/events/${id}`);
  return unwrap<Event>(res);
}

export async function fetchAdminEvents(params: {
  page?: number;
  pageSize?: number;
  status?: EventStatus;
} = {}): Promise<PagedResult<Event>> {
  const res = await client.get("/events/admin", { params });
  return unwrap<PagedResult<Event>>(res);
}

export async function fetchAdminEvent(id: string): Promise<AdminEventDetail> {
  const res = await client.get(`/events/admin/${id}`);
  return unwrap<AdminEventDetail>(res);
}
