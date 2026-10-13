import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import prisma from "./config/prisma";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import eventRoutes from "./routes/event.routes";
import paymentRoutes from "./routes/payment.routes";
import ticketRoutes from "./routes/ticket.routes";
import ticketRequestRoutes from "./routes/ticketRequest.routes";
import { razorpayWebhookController } from "./controllers/webhook.controller";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware";

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

// The Razorpay webhook needs the raw, untouched request body for
// signature verification — mount it BEFORE express.json().
app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json", limit: "256kb" }),
  razorpayWebhookController,
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Event Platform API is running",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "Database connection is working",
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/ticket-requests", ticketRequestRoutes);

app.use("/api", notFoundHandler);
app.use(errorHandler);

export { app };
