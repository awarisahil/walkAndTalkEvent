import { useEffect, useState } from "react";
import { fetchMyTicketRequests } from "../api/requests";
import { useAuth } from "../context/useAuth";
import type { TicketRequest } from "../types";

/**
 * Maps eventId → the customer's ticket request for that event.
 * Returns null while the session/request status is unknown, and an
 * (possibly empty) Map once loaded. Non-customers get null.
 */
export function useMyRequestStatuses(): Map<string, TicketRequest> | null {
  const { user, loading } = useAuth();
  const [statuses, setStatuses] = useState<Map<
    string,
    TicketRequest
  > | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user || user.role !== "CUSTOMER") {
      setStatuses(null);
      return;
    }

    let cancelled = false;

    fetchMyTicketRequests()
      .then((requests) => {
        if (cancelled) return;
        setStatuses(
          new Map(requests.map((request) => [request.event.id, request])),
        );
      })
      .catch(() => {
        if (!cancelled) setStatuses(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return statuses;
}
