import type { Request, Response } from "express";
import { guestJoinSchema } from "../validators/guestJoin.validator";
import { requestToJoinAsGuest } from "../services/ticketRequest.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest } from "../utils/AppError";

export const guestJoinController = asyncHandler(
  async (req: Request, res: Response) => {
    const validation = guestJoinSchema.safeParse(req.body);

    if (!validation.success) {
      throw badRequest("Invalid input", validation.error.flatten());
    }

    const result = await requestToJoinAsGuest(validation.data);

    return ok(
      res,
      {
        requestId: result.request.id,
        eventTitle: result.eventTitle,
        inviteToken: result.inviteToken,
        alreadyExists: result.alreadyExists,
      },
      { message: "Request submitted successfully", status: 201 },
    );
  },
);
