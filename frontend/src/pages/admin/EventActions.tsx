import { useState } from "react";
import {
  cancelEvent,
  completeEvent,
  publishEvent,
} from "../../api/events";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { Event, EventStatus } from "../../types";
import "./EventActions.css";

type ActionKind = "publish" | "cancel" | "complete";

const ACTION_COPY: Record<
  ActionKind,
  { title: string; message: (event: Event) => string; confirmLabel: string }
> = {
  publish: {
    title: "Publish this event?",
    message: (event) =>
      `"${event.title}" will become visible to customers and accept ticket requests immediately.`,
    confirmLabel: "Publish",
  },
  cancel: {
    title: "Cancel this event?",
    message: (event) =>
      `"${event.title}" will be cancelled. All pending requests will be closed and customers with reservations will be notified. This cannot be undone.`,
    confirmLabel: "Cancel event",
  },
  complete: {
    title: "Mark this event as completed?",
    message: (event) =>
      `"${event.title}" has taken place. Marking it completed closes new requests; existing tickets remain valid for check-in.`,
    confirmLabel: "Mark completed",
  },
};

function availableActions(status: EventStatus): ActionKind[] {
  switch (status) {
    case "DRAFT":
      return ["publish", "cancel"];
    case "PUBLISHED":
      return ["complete", "cancel"];
    default:
      return [];
  }
}

interface EventActionsProps {
  event: Event;
  /** Called after a successful mutation so the parent can reload. */
  onChanged: () => void;
  size?: "sm" | "md";
}

/**
 * Publish / Cancel / Complete buttons with ConfirmDialog, applicable to the
 * event's current status. Self-contained: shows its own error banner.
 */
export default function EventActions({ event, onChanged, size = "sm" }: EventActionsProps) {
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = availableActions(event.status);
  if (actions.length === 0 && !error) return null;

  async function handleConfirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending === "publish") await publishEvent(event.id);
      else if (pending === "cancel") await cancelEvent(event.id);
      else await completeEvent(event.id);
      setPending(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="event-actions">
      {error ? (
        <div className="banner banner-error event-actions-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="event-actions-buttons">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className={`btn btn-${action === "cancel" ? "danger" : "secondary"} btn-${size}`}
            onClick={() => {
              setError(null);
              setPending(action);
            }}
          >
            {action === "publish" ? "Publish" : action === "cancel" ? "Cancel" : "Complete"}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_COPY[pending].title : ""}
        message={pending ? ACTION_COPY[pending].message(event) : ""}
        confirmLabel={pending ? ACTION_COPY[pending].confirmLabel : "Confirm"}
        danger={pending === "cancel"}
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
