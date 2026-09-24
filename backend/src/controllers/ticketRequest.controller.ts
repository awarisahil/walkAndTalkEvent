import { Request, Response } from "express";
import {
  createTicketRequestSchema,
  rejectTicketRequestSchema,
} from "../validators/ticketRequest.validator";
import {
  createTicketRequest,
  getTicketRequestsForAdmin,
  approveTicketRequest,
  rejectTicketRequest,
  getMyTicketRequests,
} from "../services/ticketRequest.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export async function createTicketRequestController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    // Make sure authentication middleware provided the user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Validate request body
    const validation = createTicketRequestSchema.safeParse(
      req.body,
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten(),
      });
    }

    // Create ticket request
    const ticketRequest = await createTicketRequest(
      req.user.userId,
      validation.data,
    );

    return res.status(201).json({
      success: true,
      message: "Ticket request submitted successfully",
      data: ticketRequest,
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
        "Tickets can only be requested for published events"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message ===
        "You have already requested a ticket for this event"
      ) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error("Create ticket request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create ticket request",
    });
  }
}
export async function getTicketRequestsForAdminController(
  _req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const requests = await getTicketRequestsForAdmin();

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error(
      "Get ticket requests for admin error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket requests",
    });
  }
}
export async function approveTicketRequestController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const ticketRequestId = req.params.id;

    const ticketRequest =
      await approveTicketRequest(ticketRequestId);

    return res.status(200).json({
      success: true,
      message: "Ticket request approved",
      data: ticketRequest,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Ticket request not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message ===
        "Only pending ticket requests can be approved"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Event tickets are full") {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error(
      "Approve ticket request error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to approve ticket request",
    });
  }
}

export async function rejectTicketRequestController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const ticketRequestId = req.params.id;

    const validation = rejectTicketRequestSchema.safeParse(
      req.body,
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten(),
      });
    }

    const ticketRequest = await rejectTicketRequest(
      ticketRequestId,
      validation.data.rejectionReason,
    );

    return res.status(200).json({
      success: true,
      message: "Ticket request rejected",
      data: ticketRequest,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Ticket request not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message ===
        "Only pending ticket requests can be rejected"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    console.error(
      "Reject ticket request error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to reject ticket request",
    });
  }
}

export async function getMyTicketRequestsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const requests = await getMyTicketRequests(
      req.user.userId,
    );

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error(
      "Get my ticket requests error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket requests",
    });
  }
}