import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { createPaymentSchema } from "../validators/payment.validator";
import {
  adminPaymentQuerySchema,
  verifyPaymentSchema,
} from "../validators/query.validator";
import {
  completePaymentDev,
  createOrderForPayment,
  createPayment,
  getMyPayments,
  getPaymentById,
  listPaymentsForAdmin,
  verifyAndFulfillPayment,
} from "../services/payment.service";
import {
  getRazorpayKeyId,
  razorpayEnabled,
} from "../services/razorpay.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, parsePagination, badRequest } from "../utils/response";
import { unauthorized } from "../utils/AppError";

export const getPaymentConfigController = asyncHandler(
  async (_req: Request, res: Response) => {
    return ok(res, {
      razorpayEnabled: razorpayEnabled(),
      razorpayKeyId: getRazorpayKeyId(),
    });
  },
);

export const createPaymentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const validation = createPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const payment = await createPayment(
      req.user.userId,
      validation.data,
    );

    return ok(res, payment, {
      message: "Payment initialized successfully",
      status: 201,
    });
  },
);

export const createOrderController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const order = await createOrderForPayment(
      req.user.userId,
      String(req.params.id),
    );

    return ok(res, order);
  },
);

export const verifyPaymentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const validation = verifyPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const result = await verifyAndFulfillPayment(
      req.user.userId,
      validation.data,
    );

    return ok(res, result, {
      message: "Payment verified successfully",
    });
  },
);

export const completePaymentController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const result = await completePaymentDev(
      req.user.userId,
      String(req.params.id),
    );

    return ok(res, result, {
      message: "Payment completed and ticket generated (dev mode)",
    });
  },
);

export const getMyPaymentsController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const payments = await getMyPayments(req.user.userId);

    return ok(res, payments);
  },
);

export const getPaymentByIdController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw unauthorized();

    const payment = await getPaymentById(
      req.user.userId,
      String(req.params.id),
    );

    return ok(res, payment);
  },
);

export const listPaymentsForAdminController = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const query = adminPaymentQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw badRequest("Invalid query parameters", query.error.flatten());
    }

    const payments = await listPaymentsForAdmin(
      query.data,
      parsePagination(req.query),
    );

    return ok(res, payments);
  },
);
