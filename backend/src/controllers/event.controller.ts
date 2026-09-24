import { Request, Response } from "express";
import {
  createEventSchema,
} from "../validators/event.validator";
import {
  createEvent,
} from "../services/event.service";

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