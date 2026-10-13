import { useEffect, useState } from "react";
import { fetchMyTicketRequests } from "../api/requests";
import { useAuth } from "../context/useAuth";
import type { TicketRequest } from "../types";

/**
 * Maps eventId → the customer's ticket request for that event.
 * Returns null while the session/request status is unknown, and a
 * (possibly empty) Map once loaded. Non-customers always get null.
 */
export function useMyRequestStatuses(): Map<string, TicketRequest> | null {
  const { user, loading } = useAuth();
  const [statuses, setStatuses] = useState<Map<
    string,
    TicketRequest
  > | null>(null);

  const isCustomer = !loading && user?.role === "CUSTOMER";

  useEffect(() => {
    if (!isCustomer) return;

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
  }, [isCustomer, user?.id]);

  if (!isCustomer) return null;

  return statuses;
}
