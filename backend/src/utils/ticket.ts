import crypto from "node:crypto";

export function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `TKT-${timestamp}-${random}`;
}
