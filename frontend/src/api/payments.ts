import client from "./client";
import { unwrap } from "./auth";
import type {
  Payment,
  PaymentConfig,
  PaymentFulfillment,
  RazorpayOrderResponse,
} from "../types";

export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const res = await client.get("/payments/config");
  return unwrap<PaymentConfig>(res);
}

export async function createPayment(ticketRequestId: string): Promise<Payment> {
  const res = await client.post("/payments", { ticketRequestId });
  return unwrap<Payment>(res);
}

export async function createRazorpayOrder(paymentId: string): Promise<RazorpayOrderResponse> {
  const res = await client.post(`/payments/${paymentId}/razorpay-order`);
  return unwrap<RazorpayOrderResponse>(res);
}

export async function verifyPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<PaymentFulfillment> {
  const res = await client.post("/payments/verify", payload);
  return unwrap<PaymentFulfillment>(res);
}

export async function completePaymentDev(paymentId: string): Promise<PaymentFulfillment> {
  const res = await client.patch(`/payments/${paymentId}/complete`);
  return unwrap<PaymentFulfillment>(res);
}

export async function fetchMyPayments(): Promise<Payment[]> {
  const res = await client.get("/payments/my");
  return unwrap<Payment[]>(res);
}

export async function fetchPayment(id: string): Promise<Payment> {
  const res = await client.get(`/payments/${id}`);
  return unwrap<Payment>(res);
}
