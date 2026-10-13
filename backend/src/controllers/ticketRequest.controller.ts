import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createTicketRequestSchema,
  rejectTicketRequestSchema,
} from "../validators/ticketRequest.validator";
import { adminRequestQuerySchema } from "../validators/query.validator";
import {
  createTicketRequest,
  getTicketRequestsForAdmin,
  getTicketRequestById,
  approveTicketRequest,
  rejectTicketRequest,
  cancelTicketRequest,
  getMyTicketRequests,
  getMyPaymentPendingRequests,
} from "../services/ticketRequest.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, parsePagination, badRequest } from "../utils/response";
import { unauthorized } from "../utils/AppError";

export const createTicketRequestController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const validation = createTicketRequestSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const ticketRequest = await createTicketRequest(
      req.user.userId,
      validation.data,
    );

    return ok(res, ticketRequest, {
      message: "Ticket request submitted successfully",
      status: 201,
    });
  },
);

export const getTicketRequestByIdController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const request = await getTicketRequestById(
      req.user.userId,
      req.user.role,
      String(req.params.id),
    );

    return ok(res, request);
  },
);

export const getTicketRequestsForAdminController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const query = adminRequestQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw badRequest("Invalid query parameters", query.error.flatten());
    }

    const requests = await getTicketRequestsForAdmin(
      query.data,
      parsePagination(req.query),
    );

    return ok(res, requests);
  },
);

export const approveTicketRequestController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const ticketRequest = await approveTicketRequest(
      String(req.params.id),
    );

    return ok(res, ticketRequest, {
      message: "Ticket request approved",
    });
  },
);

export const rejectTicketRequestController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const validation = rejectTicketRequestSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const ticketRequest = await rejectTicketRequest(
      String(req.params.id),
      validation.data.rejectionReason,
    );

    return ok(res, ticketRequest, {
      message: "Ticket request rejected",
    });
  },
);

export const cancelTicketRequestController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const request = await cancelTicketRequest(
      req.user.userId,
      String(req.params.id),
    );

    return ok(res, request, {
      message: "Ticket request cancelled",
    });
  },
);

export const getMyTicketRequestsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const requests = await getMyTicketRequests(req.user.userId);

    return ok(res, requests);
  },
);

export const getMyPaymentPendingRequestsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const requests = await getMyPaymentPendingRequests(
      req.user.userId,
    );

    return ok(res, requests);
  },
);
