import "dotenv/config";
import prisma from "./config/prisma";
import { app } from "./app";
import { expireStaleReservations } from "./services/reservation.service";

const PORT = Number(process.env.PORT) || 5000;

// Periodically release expired payment reservations so capacity
// frees up even when nobody is actively using the API.
const sweepTimer = setInterval(() => {
  expireStaleReservations().catch((err) =>
    console.error("Reservation sweep failed:", err),
  );
}, 60 * 1000);
sweepTimer.unref();

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  clearInterval(sweepTimer);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  });
  // Force-exit if connections don't drain in time
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
