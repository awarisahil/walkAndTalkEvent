import crypto from "node:crypto";
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)",
    );
  }
  if (!client) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

export function razorpayEnabled(): boolean {
  return Boolean(keyId && keySecret);
}

export function razorpayWebhookConfigured(): boolean {
  return Boolean(webhookSecret);
}

export function getRazorpayKeyId(): string | null {
  return keyId ?? null;
}

export async function createRazorpayOrder(options: {
  receipt: string;
  amountInPaise: number;
}) {
  return getClient().orders.create({
    amount: options.amountInPaise,
    currency: "INR",
    receipt: options.receipt,
  });
}

export function verifyPaymentSignature(options: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!keySecret) return false;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${options.orderId}|${options.paymentId}`)
    .digest("hex");
  return safeEqual(expected, options.signature);
}

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
): boolean {
  if (!webhookSecret) return false;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
