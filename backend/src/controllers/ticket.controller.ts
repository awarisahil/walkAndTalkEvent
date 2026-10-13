import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  attendeeQuerySchema,
  checkInSchema,
} from "../validators/query.validator";
import {
  checkInTicket,
  exportEventAttendeesCsv,
  getEventAttendees,
  getMyTickets,
  getTicketById,
  lookupTicketForAdmin,
} from "../services/ticket.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, parsePagination } from "../utils/response";
import { badRequest } from "../utils/AppError";
import { unauthorized } from "../utils/AppError";

export const getMyTicketsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const tickets = await getMyTickets(req.user.userId);

    return ok(res, tickets);
  },
);

export const getTicketByIdController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const ticket = await getTicketById(
      req.user.userId,
      String(req.params.id),
    );

    return ok(res, ticket);
  },
);

export const getEventAttendeesController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = attendeeQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw badRequest("Invalid query parameters", query.error.flatten());
    }

    const pagination = parsePagination(req.query);
    const data = await getEventAttendees(String(req.params.id), {
      ...query.data,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });

    return ok(res, data);
  },
);

export const exportEventAttendeesController = asyncHandler(
  async (req: Request, res: Response) => {
    const { filename, csv } = await exportEventAttendeesCsv(
      String(req.params.id),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    return res.status(200).send(csv);
  },
);

export const lookupTicketController = asyncHandler(
  async (req: Request, res: Response) => {
    const ticketNumber = String(req.query.ticketNumber ?? "").trim();
    if (!ticketNumber) {
      throw badRequest("ticketNumber query parameter is required");
    }

    const eventId =
      typeof req.query.eventId === "string" && req.query.eventId
        ? req.query.eventId
        : undefined;

    const ticket = await lookupTicketForAdmin(ticketNumber, eventId);

    return ok(res, ticket);
  },
);

export const checkInTicketController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const validation = checkInSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const result = await checkInTicket(req.user.userId, validation.data);

    return ok(res, result, {
      message: "Ticket checked in successfully",
    });
  },
);
