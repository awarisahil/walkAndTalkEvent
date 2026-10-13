import type { Request, Response } from "express";
import {
  createEventSchema,
  updateEventSchema,
} from "../validators/event.validator";
import {
  adminEventQuerySchema,
  eventQuerySchema,
} from "../validators/query.validator";
import {
  createEvent,
  getAdminEventById,
  getPublishedEventById,
  listAdminEvents,
  listPublicEvents,
  cancelEvent,
  completeEvent,
  publishEvent,
  updateEvent,
} from "../services/event.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, parsePagination, badRequest } from "../utils/response";

export const getEventsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = eventQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw badRequest("Invalid query parameters", query.error.flatten());
    }

    const events = await listPublicEvents(
      query.data,
      parsePagination(req.query),
    );

    return ok(res, events);
  },
);

export const getAdminEventsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = adminEventQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw badRequest("Invalid query parameters", query.error.flatten());
    }

    const events = await listAdminEvents(
      query.data,
      parsePagination(req.query),
    );

    return ok(res, events);
  },
);

export const getEventByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await getPublishedEventById(String(req.params.id));
    return ok(res, event);
  },
);

export const getAdminEventByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await getAdminEventById(String(req.params.id));
    return ok(res, event);
  },
);

export const createEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = createEventSchema.safeParse(req.body);
    if (!result.success) {
      throw badRequest("Invalid input", result.error.flatten());
    }

    const event = await createEvent(result.data);

    return ok(res, event, {
      message: "Event created successfully",
      status: 201,
    });
  },
);

export const updateEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const validation = updateEventSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const event = await updateEvent(String(req.params.id), validation.data);

    return ok(res, event, { message: "Event updated successfully" });
  },
);

export const publishEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await publishEvent(String(req.params.id));
    return ok(res, event, { message: "Event published successfully" });
  },
);

export const cancelEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await cancelEvent(String(req.params.id));
    return ok(res, event, { message: "Event cancelled successfully" });
  },
);

export const completeEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const event = await completeEvent(String(req.params.id));
    return ok(res, event, { message: "Event completed successfully" });
  },
);
