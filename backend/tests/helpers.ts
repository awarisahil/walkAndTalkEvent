/**
 * Shared helpers for the integration tests. The Express app and the
 * Prisma client are imported here — never before tests/setup.ts has
 * pointed process.env.DATABASE_URL at the test database.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import type { Express } from "express";
import prisma from "../src/config/prisma";

export { prisma };

let cachedApp: Express | null = null;

export async function getApp(): Promise<Express> {
  if (!cachedApp) {
    const mod = await import("../src/app");
    cachedApp = mod.app;
  }
  return cachedApp;
}

export function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

export interface TestUser {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
    [key: string]: unknown;
  };
  email: string;
  password: string;
}

export async function registerAndLogin(prefix = "customer"): Promise<TestUser> {
  const app = await getApp();
  const email = uniqueEmail(prefix);
  const password = "TestPassword123!";
  const register = await request(app).post("/api/auth/register").send({
    name: `User ${prefix}`,
    email,
    password,
    phone: "9876543210",
    age: 25,
  });
  if (register.status !== 201) {
    throw new Error(
      `register failed (${register.status}): ${JSON.stringify(register.body)}`,
    );
  }
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  if (login.status !== 200) {
    throw new Error(
      `login failed (${login.status}): ${JSON.stringify(login.body)}`,
    );
  }
  return {
    token: login.body.data.accessToken,
    user: login.body.data.user,
    email,
    password,
  };
}

const ADMIN_PASSWORD = "AdminPassword123!";

export async function loginAdmin(): Promise<TestUser> {
  const app = await getApp();
  const email = uniqueEmail("admin");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      name: "Test Admin",
      email,
      password: passwordHash,
      role: "ADMIN",
    },
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: ADMIN_PASSWORD });
  if (login.status !== 200) {
    throw new Error(
      `admin login failed (${login.status}): ${JSON.stringify(login.body)}`,
    );
  }
  return {
    token: login.body.data.accessToken,
    user: login.body.data.user,
    email,
    password: ADMIN_PASSWORD,
  };
}

export interface CreatedEvent {
  id: string;
  title: string;
  status: string;
  capacity: number;
  ticketPrice: unknown;
  [key: string]: unknown;
}

/** Creates (and publishes) an event as the given admin token. */
export async function createEvent(
  adminToken: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedEvent> {
  const app = await getApp();
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const res = await request(app)
    .post("/api/events")
    .set(auth(adminToken))
    .send({
      title: `Event ${randomUUID().slice(0, 8)}`,
      description: "Integration test event",
      date: date.toISOString(),
      startTime: "18:00",
      endTime: "21:00",
      venue: "Test Venue",
      ticketPrice: 499,
      capacity: 10,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(
      `createEvent failed (${res.status}): ${JSON.stringify(res.body)}`,
    );
  }
  const event = res.body.data;
  const publish = await request(app)
    .patch(`/api/events/${event.id}/publish`)
    .set(auth(adminToken));
  if (publish.status !== 200) {
    throw new Error(
      `publish failed (${publish.status}): ${JSON.stringify(publish.body)}`,
    );
  }
  return { ...event, status: "PUBLISHED" };
}

export async function requestTicket(token: string, eventId: string) {
  const app = await getApp();
  return request(app)
    .post("/api/ticket-requests")
    .set(auth(token))
    .send({ eventId });
}

export async function approveRequest(adminToken: string, requestId: string) {
  const app = await getApp();
  return request(app)
    .patch(`/api/ticket-requests/${requestId}/approve`)
    .set(auth(adminToken));
}

/**
 * Full happy-path payment: create the payment and fulfill it via the
 * dev-only endpoint. Returns the created ticket (from the API response).
 */
export async function payRequestFully(
  customer: TestUser,
  requestId: string,
): Promise<{ paymentId: string; ticket: Record<string, unknown> }> {
  const app = await getApp();
  const payment = await request(app)
    .post("/api/payments")
    .set(auth(customer.token))
    .send({ ticketRequestId: requestId });
  if (payment.status !== 201) {
    throw new Error(
      `createPayment failed (${payment.status}): ${JSON.stringify(payment.body)}`,
    );
  }
  const completed = await request(app)
    .patch(`/api/payments/${payment.body.data.id}/complete`)
    .set(auth(customer.token));
  if (completed.status !== 200) {
    throw new Error(
      `completePayment failed (${completed.status}): ${JSON.stringify(completed.body)}`,
    );
  }
  return {
    paymentId: payment.body.data.id,
    ticket: completed.body.data.ticket,
  };
}

/** Register a customer, request a ticket for the event, get it approved. */
export async function customerWithApprovedRequest(
  eventId: string,
  adminToken: string,
): Promise<{ customer: TestUser; requestId: string }> {
  const customer = await registerAndLogin("cap-customer");
  const created = await requestTicket(customer.token, eventId);
  if (created.status !== 201) {
    throw new Error(
      `requestTicket failed (${created.status}): ${JSON.stringify(created.body)}`,
    );
  }
  const approved = await approveRequest(adminToken, created.body.data.id);
  if (approved.status !== 200) {
    throw new Error(
      `approve failed (${approved.status}): ${JSON.stringify(approved.body)}`,
    );
  }
  return { customer, requestId: created.body.data.id };
}
