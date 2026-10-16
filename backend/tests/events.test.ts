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
  uniqueEmail,
} from "./helpers";
import prisma from "../src/config/prisma";

describe("events", () => {
  it("admin creates an event as DRAFT: in admin list, hidden from public list", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const created = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({
        title: "Draft Event",
        date: future.toISOString(),
        venue: "Some Venue",
        ticketPrice: 100,
        capacity: 20,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("DRAFT");
    const eventId = created.body.data.id;

    const adminList = await request(app)
      .get("/api/events/admin")
      .set(auth(admin.token));
    expect(adminList.status).toBe(200);
    expect(
      adminList.body.data.items.map((e: { id: string }) => e.id),
    ).toContain(eventId);

    const publicList = await request(app).get("/api/events");
    expect(publicList.status).toBe(200);
    expect(
      publicList.body.data.items.map((e: { id: string }) => e.id),
    ).not.toContain(eventId);
  });

  it("published event appears publicly; customer POST → 403; anonymous → 401", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    expect(event.status).toBe("PUBLISHED");

    const publicList = await request(app).get("/api/events");
    expect(
      publicList.body.data.items.map((e: { id: string }) => e.id),
    ).toContain(event.id);

    const customer = await registerAndLogin("ev-forbidden");
    const forbidden = await request(app)
      .post("/api/events")
      .set(auth(customer.token))
      .send({
        title: "Customer Event",
        date: new Date(Date.now() + 86400000).toISOString(),
        venue: "Venue",
        ticketPrice: 10,
        capacity: 5,
      });
    expect(forbidden.status).toBe(403);

    const anon = await request(app)
      .post("/api/events")
      .send({
        title: "Anonymous Event",
        date: new Date(Date.now() + 86400000).toISOString(),
        venue: "Venue",
        ticketPrice: 10,
        capacity: 5,
      });
    expect(anon.status).toBe(401);
  });

  it("rejects invalid event data with 400", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const valid = {
      title: "Valid Base",
      date: future.toISOString(),
      venue: "Venue",
      ticketPrice: 100,
      capacity: 10,
    };

    const past = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...valid, title: "Past Event", date: "2020-01-01T00:00:00.000Z" });
    expect(past.status).toBe(400);

    const negativePrice = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...valid, title: "Negative Price", ticketPrice: -5 });
    expect(negativePrice.status).toBe(400);

    const zeroCapacity = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...valid, title: "Zero Capacity", capacity: 0 });
    expect(zeroCapacity.status).toBe(400);

    const badDate = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...valid, title: "Bad Date", date: "not-a-date" });
    expect(badDate.status).toBe(400);

    const longStartTime = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...valid, title: "Long Time", startTime: "x".repeat(25) });
    expect(longStartTime.status).toBe(400);
  });

  it("search filters by title and venue; pagination respected in meta", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const token = "sunny" + Date.now();
    const titles = [
      `${token} Morning Walk`,
      `${token} Evening Walk`,
      `${token} Night Walk`,
    ];
    for (const title of titles) {
      await createEvent(admin.token, {
        title,
        venue: title.includes("Night") ? `${token} Gardens` : "Plain Hall",
      });
    }

    const byTitle = await request(app).get(
      `/api/events?search=${encodeURIComponent(token)}`,
    );
    expect(byTitle.status).toBe(200);
    expect(byTitle.body.data.items).toHaveLength(3);
    expect(byTitle.body.data.meta.total).toBe(3);

    const byVenue = await request(app).get(
      `/api/events?search=${encodeURIComponent(`${token} Gardens`)}`,
    );
    expect(byVenue.status).toBe(200);
    expect(byVenue.body.data.items).toHaveLength(1);
    expect(byVenue.body.data.items[0].title).toBe(`${token} Night Walk`);

    const page1 = await request(app).get(
      `/api/events?search=${encodeURIComponent(token)}&page=1&pageSize=2`,
    );
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.meta).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 2,
      totalPages: 2,
    });

    const page2 = await request(app).get(
      `/api/events?search=${encodeURIComponent(token)}&page=2&pageSize=2`,
    );
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.meta.page).toBe(2);
  });

  it("state machine: cancelled events not editable; publish/complete guards", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const base = {
      date: future.toISOString(),
      venue: "Venue",
      ticketPrice: 100,
      capacity: 10,
    };

    // Cancelled event cannot be edited.
    const cancelTarget = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...base, title: "To Be Cancelled" });
    const cancelId = cancelTarget.body.data.id;
    const cancelled = await request(app)
      .patch(`/api/events/${cancelId}/cancel`)
      .set(auth(admin.token));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    const editCancelled = await request(app)
      .patch(`/api/events/${cancelId}`)
      .set(auth(admin.token))
      .send({ title: "Edited After Cancel" });
    expect(editCancelled.status).toBe(409);

    // A cancelled event cannot be published again.
    const republishCancelled = await request(app)
      .patch(`/api/events/${cancelId}/publish`)
      .set(auth(admin.token));
    expect(republishCancelled.status).toBe(409);

    // Re-publishing a PUBLISHED event is idempotent (200, not 409).
    const publishTarget = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...base, title: "Publish Twice" });
    const publishId = publishTarget.body.data.id;
    const first = await request(app)
      .patch(`/api/events/${publishId}/publish`)
      .set(auth(admin.token));
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe("PUBLISHED");
    const second = await request(app)
      .patch(`/api/events/${publishId}/publish`)
      .set(auth(admin.token));
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe("PUBLISHED");

    // Complete only works from PUBLISHED.
    const draft = await request(app)
      .post("/api/events")
      .set(auth(admin.token))
      .send({ ...base, title: "Complete From Draft" });
    const completeDraft = await request(app)
      .patch(`/api/events/${draft.body.data.id}/complete`)
      .set(auth(admin.token));
    expect(completeDraft.status).toBe(409);

    const completePublished = await request(app)
      .patch(`/api/events/${publishId}/complete`)
      .set(auth(admin.token));
    expect(completePublished.status).toBe(200);
    expect(completePublished.body.data.status).toBe("COMPLETED");
    const completeAgain = await request(app)
      .patch(`/api/events/${publishId}/complete`)
      .set(auth(admin.token));
    expect(completeAgain.status).toBe(200);
  });

  it("capacity cannot be reduced below reserved places", async () => {
    const app = await getApp();
    const admin = await loginAdmin();

    // Event with capacity 1, one reserved place.
    const small = await createEvent(admin.token, {
      title: "Capacity One",
      capacity: 1,
    });
    const customer = await registerAndLogin("ev-cap");
    const requested = await requestTicket(customer.token, small.id);
    expect(requested.status).toBe(201);
    const approved = await approveRequest(admin.token, requested.body.data.id);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("PAYMENT_PENDING");

    // capacity 0 is rejected by validation (must be a positive integer).
    const zero = await request(app)
      .patch(`/api/events/${small.id}`)
      .set(auth(admin.token))
      .send({ capacity: 0 });
    expect(zero.status).toBe(400);

    // Same capacity as occupied is allowed.
    const same = await request(app)
      .patch(`/api/events/${small.id}`)
      .set(auth(admin.token))
      .send({ capacity: 1 });
    expect(same.status).toBe(200);

    // Event with capacity 2 and two reserved places.
    const larger = await createEvent(admin.token, {
      title: "Capacity Two",
      capacity: 2,
    });
    const c1 = await registerAndLogin("ev-cap1");
    const c2 = await registerAndLogin("ev-cap2");
    const r1 = await requestTicket(c1.token, larger.id);
    const r2 = await requestTicket(c2.token, larger.id);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect((await approveRequest(admin.token, r1.body.data.id)).status).toBe(200);
    expect((await approveRequest(admin.token, r2.body.data.id)).status).toBe(200);

    const reduce = await request(app)
      .patch(`/api/events/${larger.id}`)
      .set(auth(admin.token))
      .send({ capacity: 1 });
    expect(reduce.status).toBe(409);
  });

  it("completing an event invalidates its tickets", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { capacity: 5 });

    const customer = await registerAndLogin("ev-complete");
    const req = await requestTicket(customer.token, event.id);
    await approveRequest(admin.token, req.body.data.id);
    const payment = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: req.body.data.id });
    const done = await request(app)
      .patch(`/api/payments/${payment.body.data.id}/complete`)
      .set(auth(customer.token));
    expect(done.status).toBe(200);
    const ticketId = done.body.data.ticket.id;
    expect(done.body.data.ticket.status).toBe("ACTIVE");

    const completed = await request(app)
      .patch(`/api/events/${event.id}/complete`)
      .set(auth(admin.token));
    expect(completed.status).toBe(200);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket!.status).toBe("CANCELLED");

    // Destroyed tickets cannot be checked in
    const checkIn = await request(app)
      .post("/api/tickets/check-in")
      .set(auth(admin.token))
      .send({ ticketNumber: ticket!.ticketNumber, eventId: event.id });
    expect(checkIn.status).toBe(409);
  });
});
