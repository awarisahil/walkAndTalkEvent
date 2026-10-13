import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  approveRequest,
  auth,
  createEvent,
  getApp,
  loginAdmin,
  registerAndLogin,
  requestTicket,
} from "./helpers";

describe("ticket requests", () => {
  it("customer requests a ticket: 201 PENDING; duplicate 409; DRAFT event 400", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const customer = await registerAndLogin("tr-basic");

    const created = await requestTicket(customer.token, event.id);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("PENDING");
    expect(created.body.data.event.id).toBe(event.id);

    const duplicate = await requestTicket(customer.token, event.id);
    expect(duplicate.status).toBe(409);

    // DRAFT event exists but is not open for requests → 400.
    const draft = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({
        title: "Draft For Request",
        date: new Date(Date.now() + 86400000).toISOString(),
        venue: "Venue",
        ticketPrice: 100,
        capacity: 5,
      });
    expect(draft.status).toBe(201);
    const forDraft = await requestTicket(customer.token, draft.body.data.id);
    expect(forDraft.status).toBe(400);

    // Unknown event → 404.
    const missing = await requestTicket(customer.token, "no-such-event-id");
    expect(missing.status).toBe(404);
  });

  it("GET /my lists only own requests; other customer 403; admin 200", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const owner = await registerAndLogin("tr-owner");
    const stranger = await registerAndLogin("tr-stranger");

    const created = await requestTicket(owner.token, event.id);
    expect(created.status).toBe(201);
    const requestId = created.body.data.id;

    const mine = await request(app)
      .get("/api/ticket-requests/my")
      .set(auth(owner.token));
    expect(mine.status).toBe(200);
    expect(
      mine.body.data.map((r: { id: string }) => r.id),
    ).toContain(requestId);

    const strangers = await request(app)
      .get("/api/ticket-requests/my")
      .set(auth(stranger.token));
    expect(
      strangers.body.data.map((r: { id: string }) => r.id),
    ).not.toContain(requestId);

    const strangerView = await request(app)
      .get(`/api/ticket-requests/${requestId}`)
      .set(auth(stranger.token));
    expect(strangerView.status).toBe(403);

    const adminView = await request(app)
      .get(`/api/ticket-requests/${requestId}`)
      .set(auth(admin.token));
    expect(adminView.status).toBe(200);
    expect(adminView.body.data.id).toBe(requestId);
  });

  it("approve → PAYMENT_PENDING (re-approve 409); reject stores reason (approve-after-reject 409)", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const customer = await registerAndLogin("tr-review");

    const created = await requestTicket(customer.token, event.id);
    const requestId = created.body.data.id;

    const approved = await approveRequest(admin.token, requestId);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("PAYMENT_PENDING");
    expect(approved.body.data.reviewedAt).toBeTruthy();

    const reApprove = await approveRequest(admin.token, requestId);
    expect(reApprove.status).toBe(409);

    // Rejection path on a second request.
    const customer2 = await registerAndLogin("tr-reject");
    const created2 = await requestTicket(customer2.token, event.id);
    const requestId2 = created2.body.data.id;

    const rejected = await request(app)
      .patch(`/api/ticket-requests/${requestId2}/reject`)
      .set(auth(admin.token))
      .send({ rejectionReason: "Event is full" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(rejected.body.data.rejectionReason).toBe("Event is full");

    const approveAfterReject = await approveRequest(admin.token, requestId2);
    expect(approveAfterReject.status).toBe(409);
  });

  it("customer cancels PENDING; cannot cancel once a payment is on record", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const customer = await registerAndLogin("tr-cancel");

    const created = await requestTicket(customer.token, event.id);
    const cancelled = await request(app)
      .patch(`/api/ticket-requests/${created.body.data.id}/cancel`)
      .set(auth(customer.token));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    // Second customer: approve, then create a payment — cancel must 409.
    const customer2 = await registerAndLogin("tr-cancel2");
    const created2 = await requestTicket(customer2.token, event.id);
    expect(
      (await approveRequest(admin.token, created2.body.data.id)).status,
    ).toBe(200);

    const payment = await request(app)
      .post("/api/payments")
      .set(auth(customer2.token))
      .send({ ticketRequestId: created2.body.data.id });
    expect(payment.status).toBe(201);

    const cancelWithPayment = await request(app)
      .patch(`/api/ticket-requests/${created2.body.data.id}/cancel`)
      .set(auth(customer2.token));
    expect(cancelWithPayment.status).toBe(409);

    // Strangers cannot cancel someone else's request either.
    const victim = await registerAndLogin("tr-victim");
    const stranger = await registerAndLogin("tr-stranger-cancel");
    const victimRequest = await requestTicket(victim.token, event.id);
    expect(victimRequest.status).toBe(201);
    const strangerCancel = await request(app)
      .patch(`/api/ticket-requests/${victimRequest.body.data.id}/cancel`)
      .set(auth(stranger.token));
    expect(strangerCancel.status).toBe(403);
  });

  it("admin filters: status, eventId, search by customer name", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const eventA = await createEvent(admin.token);
    const eventB = await createEvent(admin.token);

    const alice = await registerAndLogin("tr-alice");
    const bob = await registerAndLogin("tr-bob");
    await requestTicket(alice.token, eventA.id);
    await requestTicket(bob.token, eventA.id);
    await requestTicket(alice.token, eventB.id);

    // Scoped to eventA: both requests are PENDING.
    const byStatus = await request(app)
      .get(
        `/api/ticket-requests/admin?status=PENDING&eventId=${eventA.id}`,
      )
      .set(auth(admin.token));
    expect(byStatus.status).toBe(200);
    expect(byStatus.body.data.meta.total).toBe(2);
    expect(
      byStatus.body.data.items.every(
        (r: { status: string }) => r.status === "PENDING",
      ),
    ).toBe(true);

    const byEvent = await request(app)
      .get(`/api/ticket-requests/admin?eventId=${eventA.id}`)
      .set(auth(admin.token));
    expect(byEvent.body.data.meta.total).toBe(2);

    // Approve Alice's eventB request, then filter by PAYMENT_PENDING.
    const aliceEventB = await request(app)
      .get("/api/ticket-requests/my")
      .set(auth(alice.token));
    const eventBRequest = aliceEventB.body.data.find(
      (r: { event: { id: string } }) => r.event.id === eventB.id,
    );
    await approveRequest(admin.token, eventBRequest.id);

    const byPaymentPending = await request(app)
      .get(
        `/api/ticket-requests/admin?status=PAYMENT_PENDING&eventId=${eventB.id}`,
      )
      .set(auth(admin.token));
    expect(byPaymentPending.body.data.meta.total).toBe(1);
    expect(byPaymentPending.body.data.items[0].id).toBe(eventBRequest.id);

    // Search matches the customer's name (case-insensitive substring).
    const byName = await request(app)
      .get(
        `/api/ticket-requests/admin?search=${encodeURIComponent("User tr-alice")}`,
      )
      .set(auth(admin.token));
    expect(byName.status).toBe(200);
    expect(byName.body.data.meta.total).toBe(2);
    expect(
      byName.body.data.items.every((r: { user: { email: string } }) =>
        r.user.email.includes("tr-alice"),
      ),
    ).toBe(true);
  });
});
