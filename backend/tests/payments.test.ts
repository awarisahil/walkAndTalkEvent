import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  approveRequest,
  auth,
  createEvent,
  getApp,
  loginAdmin,
  prisma,
  registerAndLogin,
  requestTicket,
} from "./helpers";

describe("payments", () => {
  it("creates a payment for an approved request; amount comes from the DB", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { ticketPrice: 777 });
    const customer = await registerAndLogin("pay-basic");

    const created = await requestTicket(customer.token, event.id);
    expect(
      (await approveRequest(admin.token, created.body.data.id)).status,
    ).toBe(200);

    const res = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: created.body.data.id });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.ticketRequest.status).toBe("PAYMENT_PENDING");

    // Amount is the server's event.ticketPrice, not a client-supplied value.
    const eventFromDb = await prisma.event.findUnique({
      where: { id: event.id },
    });
    expect(Number(res.body.data.amount)).toBe(
      Number(eventFromDb!.ticketPrice),
    );
  });

  it("403 for another user's request; 400 for an unapproved request", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);

    const owner = await registerAndLogin("pay-owner");
    const stranger = await registerAndLogin("pay-stranger");

    const created = await requestTicket(owner.token, event.id);
    const requestId = created.body.data.id;
    expect((await approveRequest(admin.token, requestId)).status).toBe(200);

    const forbidden = await request(app)
      .post("/api/payments")
      .set(auth(stranger.token))
      .send({ ticketRequestId: requestId });
    expect(forbidden.status).toBe(403);

    // PENDING (not yet approved) request → 400.
    const pendingCustomer = await registerAndLogin("pay-pending");
    const pendingRequest = await requestTicket(pendingCustomer.token, event.id);
    const bad = await request(app)
      .post("/api/payments")
      .set(auth(pendingCustomer.token))
      .send({ ticketRequestId: pendingRequest.body.data.id });
    expect(bad.status).toBe(400);
  });

  it("duplicate payment creation is idempotent: same row, no second insert", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const customer = await registerAndLogin("pay-idem");

    const created = await requestTicket(customer.token, event.id);
    const requestId = created.body.data.id;
    await approveRequest(admin.token, requestId);

    const first = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: requestId });
    const second = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: requestId });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const paymentCount = await prisma.payment.count({
      where: { ticketRequestId: requestId },
    });
    expect(paymentCount).toBe(1);
  });

  it("dev-only complete: SUCCESS + PAID + ticket with qrCode; replay is a no-op", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const customer = await registerAndLogin("pay-complete");

    const created = await requestTicket(customer.token, event.id);
    const requestId = created.body.data.id;
    await approveRequest(admin.token, requestId);

    const payment = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: requestId });
    expect(payment.status).toBe(201);

    const completed = await request(app)
      .patch(`/api/payments/${payment.body.data.id}/complete`)
      .set(auth(customer.token));
    expect(completed.status).toBe(200);
    expect(completed.body.data.alreadyProcessed).toBe(false);
    expect(completed.body.data.payment.status).toBe("SUCCESS");
    expect(completed.body.data.ticket.qrCode).toBeTruthy();
    expect(completed.body.data.ticket.ticketNumber).toBeTruthy();

    // Request is PAID and exactly one ticket exists.
    const requestFromDb = await prisma.ticketRequest.findUnique({
      where: { id: requestId },
    });
    expect(requestFromDb!.status).toBe("PAID");
    expect(
      await prisma.ticket.count({ where: { ticketRequestId: requestId } }),
    ).toBe(1);

    // Second call returns alreadyProcessed and still creates nothing.
    const replay = await request(app)
      .patch(`/api/payments/${payment.body.data.id}/complete`)
      .set(auth(customer.token));
    expect(replay.status).toBe(200);
    expect(replay.body.data.alreadyProcessed).toBe(true);
    expect(
      await prisma.ticket.count({ where: { ticketRequestId: requestId } }),
    ).toBe(1);
  });

  it("GET /my and GET /:id enforce ownership", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const owner = await registerAndLogin("pay-list-owner");
    const stranger = await registerAndLogin("pay-list-stranger");

    const created = await requestTicket(owner.token, event.id);
    const requestId = created.body.data.id;
    await approveRequest(admin.token, requestId);
    const payment = await request(app)
      .post("/api/payments")
      .set(auth(owner.token))
      .send({ ticketRequestId: requestId });
    const paymentId = payment.body.data.id;

    const mine = await request(app)
      .get("/api/payments/my")
      .set(auth(owner.token));
    expect(mine.status).toBe(200);
    expect(
      mine.body.data.map((p: { id: string }) => p.id),
    ).toContain(paymentId);

    const mineEmpty = await request(app)
      .get("/api/payments/my")
      .set(auth(stranger.token));
    expect(
      mineEmpty.body.data.map((p: { id: string }) => p.id),
    ).not.toContain(paymentId);

    const byId = await request(app)
      .get(`/api/payments/${paymentId}`)
      .set(auth(owner.token));
    expect(byId.status).toBe(200);
    expect(byId.body.data.id).toBe(paymentId);

    const strangerById = await request(app)
      .get(`/api/payments/${paymentId}`)
      .set(auth(stranger.token));
    expect(strangerById.status).toBe(403);
  });

  it("Razorpay order/verify fail closed when keys are absent", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const customer = await registerAndLogin("pay-rzp");

    const created = await requestTicket(customer.token, event.id);
    const requestId = created.body.data.id;
    await approveRequest(admin.token, requestId);
    const payment = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: requestId });
    const paymentId = payment.body.data.id;

    // Order creation must not silently succeed without keys.
    const order = await request(app)
      .post(`/api/payments/${paymentId}/razorpay-order`)
      .set(auth(customer.token));
    expect(order.status).toBe(400);
    expect(order.body.message).toMatch(/not configured/i);

    // Simulate a client callback; without keys verification must fail
    // closed (400) — never fulfill the payment.
    await prisma.payment.update({
      where: { id: paymentId },
      data: { providerOrderId: "order_test_123" },
    });
    const verify = await request(app)
      .post("/api/payments/verify")
      .set(auth(customer.token))
      .send({
        razorpayOrderId: "order_test_123",
        razorpayPaymentId: "pay_test_123",
        razorpaySignature: "deadbeef",
      });
    expect(verify.status).toBe(400);

    const paymentFromDb = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    expect(paymentFromDb!.status).toBe("PENDING");
    expect(
      await prisma.ticket.count({ where: { ticketRequestId: requestId } }),
    ).toBe(0);
  });
});
