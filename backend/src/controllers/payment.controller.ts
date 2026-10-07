import { Response } from "express";
import {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import {
  createPaymentSchema,
} from "../validators/payment.validator";
import {
  createPayment,
  getMyPayments,
  getPaymentById,
  completePayment,
} from "../services/payment.service";
export async function createPaymentController(
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

    const validation = createPaymentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten(),
      });
    }

    const payment = await createPayment(
      req.user.userId,
      validation.data,
    );

    return res.status(201).json({
      success: true,
      message: "Payment initialized successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Create payment error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize payment";

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

export async function getMyPaymentsController(
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

    const payments = await getMyPayments(req.user.userId);

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Get my payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
}


export async function getPaymentByIdController(
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

   const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

    const payment = await getPaymentById(
      req.user.userId,
      id,
    );

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Get payment error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch payment";

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

export async function completePaymentController(
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

     const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

    const result = await completePayment(
      req.user.userId,
      id,
    );

    return res.status(200).json({
      success: true,
      message: "Payment completed and ticket generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Complete payment error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to complete payment";

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