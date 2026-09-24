import { Request, Response } from "express";
import {
  createEventSchema,
  updateEventSchema,
} from "../validators/event.validator";
import {
  createEvent,
  getPublishedEvents,
  getPublishedEventById,
  publishEvent,
  updateEvent,
  cancelEvent,
  completeEvent,
} from "../services/event.service";
export async function completeEventController(
  req: Request,
  res: Response,
) {
  try {
    const eventId = req.params.id;

    const event = await completeEvent(eventId);

    return res.status(200).json({
      success: true,
      message: "Event completed successfully",
      data: event,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Event not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message === "Event is already completed" ||
        error.message ===
          "Only published events can be completed"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error("Complete event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete event",
    });
  }
}
export async function cancelEventController(
  req: Request,
  res: Response,
) {
  try {
    const eventId = req.params.id;

    const event = await cancelEvent(eventId);

    return res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      data: event,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Event not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message === "Event is already cancelled" ||
        error.message === "Completed events cannot be cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error("Cancel event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel event",
    });
  }
}
export async function updateEventController(
  req: Request,
  res: Response,
) {
  try {
    const eventId = req.params.id;

    const validation = updateEventSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten(),
      });
    }

    const event = await updateEvent(
      eventId,
      validation.data,
    );

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Event not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message ===
        "Cancelled or completed events cannot be edited"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error("Update event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
}
export async function publishEventController(
  req: Request,
  res: Response,
) {
  try {
    const event = await publishEvent(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Event published successfully",
      data: event,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Event not found") {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      if (
        error.message === "Only draft events can be published"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error("Publish event error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
export async function getEventsController(
  _req: Request,
  res: Response,
) {
  try {
    const events = await getPublishedEvents();

    return res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get events error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function getEventByIdController(
  req: Request,
  res: Response,
) {
  try {
    const event = await getPublishedEventById(req.params.id);

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Event not found"
    ) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    console.error("Get event error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
export async function createEventController(
  req: Request,
  res: Response,
) {
  try {
    const result = createEventSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: result.error.flatten(),
      });
    }

    const event = await createEvent(result.data);

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: event,
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}