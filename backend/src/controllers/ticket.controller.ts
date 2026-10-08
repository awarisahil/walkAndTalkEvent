import { Response } from "express";
import {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import {
  getMyTickets,
  getTicketById,
} from "../services/ticket.service";

export async function getMyTicketsController(
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

    const tickets = await getMyTickets(req.user.userId);

    return res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error("Get my tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
    });
  }
}
export async function getTicketByIdController(
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

    const ticketId = req.params.id;

    if (typeof ticketId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const ticket = await getTicketById(
      req.user.userId,
      ticketId,
    );

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Get ticket error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch ticket";

    const statusCode =
      message.includes("permission")
        ? 403
        : message.includes("not found")
          ? 404
          : 400;

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}