import client from "./client";
import { unwrap } from "./auth";
import type {
  AdminEvent,
  AdminEventDetail,
  AttendeesResponse,
  Event,
  EventInputPayload,
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
  search?: string;
  page?: number;
  pageSize?: number;
  status?: EventStatus;
} = {}): Promise<PagedResult<AdminEvent>> {
  const res = await client.get("/events/admin", { params });
  return unwrap<PagedResult<AdminEvent>>(res);
}

export async function fetchAdminEvent(id: string): Promise<AdminEventDetail> {
  const res = await client.get(`/events/admin/${id}`);
  return unwrap<AdminEventDetail>(res);
}

export async function createEvent(payload: EventInputPayload): Promise<Event> {
  const res = await client.post("/events", payload);
  return unwrap<Event>(res);
}

export async function updateEvent(id: string, payload: Partial<EventInputPayload>): Promise<Event> {
  const res = await client.patch(`/events/${id}`, payload);
  return unwrap<Event>(res);
}

export async function publishEvent(id: string): Promise<Event> {
  const res = await client.patch(`/events/${id}/publish`);
  return unwrap<Event>(res);
}

export async function cancelEvent(id: string): Promise<Event> {
  const res = await client.patch(`/events/${id}/cancel`);
  return unwrap<Event>(res);
}

export async function completeEvent(id: string): Promise<Event> {
  const res = await client.patch(`/events/${id}/complete`);
  return unwrap<Event>(res);
}

export async function fetchAttendees(
  eventId: string,
  params: { search?: string; status?: string; page?: number; pageSize?: number } = {},
): Promise<AttendeesResponse> {
  const res = await client.get(`/events/${eventId}/attendees`, { params });
  return unwrap<AttendeesResponse>(res);
}

/**
 * CSV export must travel through axios (the Authorization header) — a plain
 * <a href> would not be authenticated. Returns the raw CSV text.
 */
export async function exportAttendeesCsv(eventId: string): Promise<string> {
  const res = await client.get(`/events/${eventId}/attendees/export`, {
    responseType: "blob",
  });
  const blob = unwrap<Blob>(res);
  if (blob instanceof Blob) {
    return blob.text();
  }
  return String(res);
}
