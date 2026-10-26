import client from "./client";
import { unwrap } from "./auth";
import type {
  InvitePayResponse,
  InviteState,
  InviteUpiQrResponse,
  InviteVerifyResponse,
} from "../types";

export async function getInviteState(token: string): Promise<InviteState> {
  const res = await client.get(`/invites/${token}`);
  return unwrap<InviteState>(res);
}

/** Creates the payment (+ Razorpay order when configured) for an invite. */
export async function invitePay(token: string): Promise<InvitePayResponse> {
  const res = await client.post(`/invites/${token}/pay`);
  return unwrap<InvitePayResponse>(res);
}

export async function inviteVerify(
  token: string,
  payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
): Promise<InviteVerifyResponse> {
  const res = await client.post(`/invites/${token}/verify`, payload);
  return unwrap<InviteVerifyResponse>(res);
}

/** Development-only stand-in for the Razorpay callback (local backends). */
export async function inviteDevComplete(token: string): Promise<InviteVerifyResponse> {
  const res = await client.post(`/invites/${token}/dev-complete`);
  return unwrap<InviteVerifyResponse>(res);
}

/** Creates (or reuses) a Razorpay Payment Link and returns its QR target. */
export async function inviteUpiQr(token: string): Promise<InviteUpiQrResponse> {
  const res = await client.post(`/invites/${token}/upi-qr`);
  return unwrap<InviteUpiQrResponse>(res);
}
