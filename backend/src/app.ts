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
import communityRoutes from "./routes/community.routes";
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

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: null,
        // Razorpay Checkout loads its script + iframe and talks to its API.
        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
        frameSrc: [
          "'self'",
          "https://checkout.razorpay.com",
          "https://api.razorpay.com",
          "https://www.instagram.com",
          "https://instagram.com",
        ],
        connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    strictTransportSecurity: false,
    // COOP is ignored on plain-HTTP origins (and can break the Razorpay
    // checkout redirect flow), so leave it off.
    crossOriginOpenerPolicy: false,
  }),
);
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
app.use("/api/community", communityRoutes);

app.use("/api", notFoundHandler);

// Optional: serve the built frontend from the same process (production).
// SERVE_STATIC_DIR points at frontend/dist on the server.
const staticDir = process.env.SERVE_STATIC_DIR;
if (staticDir) {
  app.use(
    express.static(staticDir, {
      maxAge: "1h",
      setHeaders(res, path) {
        if (path.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(`${staticDir}/index.html`);
  });
}

app.use(errorHandler);

export { app };
