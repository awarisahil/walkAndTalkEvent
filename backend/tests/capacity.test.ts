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

describe("capacity reservation under concurrency", () => {
  it("capacity 1: two parallel approvals → exactly one 200 and one 409", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { capacity: 1 });

    const c1 = await registerAndLogin("cap-c1");
    const c2 = await registerAndLogin("cap-c2");
    const r1 = await requestTicket(c1.token, event.id);
    const r2 = await requestTicket(c2.token, event.id);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    // Fire both approvals truly in parallel.
    const [a1, a2] = await Promise.all([
      approveRequest(admin.token, r1.body.data.id),
      approveRequest(admin.token, r2.body.data.id),
    ]);
    const statuses = [a1.status, a2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = a1.status === 200 ? a1 : a2;
    expect(winner.body.data.status).toBe("PAYMENT_PENDING");

    // Attendee stats: one reserved place, none confirmed yet.
    const attendees = await request(app)
      .get(`/api/events/${event.id}/attendees`)
      .set(auth(admin.token));
    expect(attendees.status).toBe(200);
    expect(attendees.body.data.stats).toMatchObject({
      capacity: 1,
      reserved: 1,
      confirmed: 0,
      used: 0,
      remaining: 0,
    });
  });

  it("capacity 2: four parallel approvals → exactly two 200s", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { capacity: 2 });

    const customers = await Promise.all([
      registerAndLogin("cap-d1"),
      registerAndLogin("cap-d2"),
      registerAndLogin("cap-d3"),
      registerAndLogin("cap-d4"),
    ]);
    const requestIds: string[] = [];
    for (const c of customers) {
      const res = await requestTicket(c.token, event.id);
      expect(res.status).toBe(201);
      requestIds.push(res.body.data.id);
    }

    const results = await Promise.all(
      requestIds.map((id) => approveRequest(admin.token, id)),
    );
    const okCount = results.filter((r) => r.status === 200).length;
    const conflictCount = results.filter((r) => r.status === 409).length;
    expect(okCount).toBe(2);
    expect(conflictCount).toBe(2);

    const attendees = await request(app)
      .get(`/api/events/${event.id}/attendees`)
      .set(auth(admin.token));
    expect(attendees.body.data.stats).toMatchObject({
      capacity: 2,
      reserved: 2,
      confirmed: 0,
      remaining: 0,
    });
  });

  it("a payment-pending reservation reduces public availability", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { capacity: 3 });

    const before = await request(app).get(`/api/events/${event.id}`);
    expect(before.status).toBe(200);
    expect(before.body.data.available).toBe(3);

    const customer = await registerAndLogin("cap-avail");
    const created = await requestTicket(customer.token, event.id);
    expect(
      (await approveRequest(admin.token, created.body.data.id)).status,
    ).toBe(200);

    const after = await request(app).get(`/api/events/${event.id}`);
    expect(after.body.data.available).toBe(2);
    expect(after.body.data.occupied).toBe(1);
  });
});
