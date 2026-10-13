import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  approveRequest,
  auth,
  createEvent,
  getApp,
  loginAdmin,
  payRequestFully,
  prisma,
  registerAndLogin,
  requestTicket,
} from "./helpers";

async function customerWithTicket(
  eventId: string,
  adminToken: string,
  prefix = "tick-customer",
) {
  const customer = await registerAndLogin(prefix);
  const created = await requestTicket(customer.token, eventId);
  expect(created.status).toBe(201);
  expect(
    (await approveRequest(adminToken, created.body.data.id)).status,
  ).toBe(200);
  const { ticket } = await payRequestFully(customer, created.body.data.id);
  return { customer, ticket };
}

describe("tickets & attendees", () => {
  it("my tickets and ticket-by-id enforce ownership", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);

    const { customer, ticket } = await customerWithTicket(event.id, admin.token);
    const stranger = await registerAndLogin("tick-stranger");

    const mine = await request(app)
      .get("/api/tickets/my")
      .set(auth(customer.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].ticketNumber).toBe(ticket.ticketNumber);
    expect(mine.body.data[0].qrCode).toBeTruthy();
    expect(mine.body.data[0].event.id).toBe(event.id);

    const byId = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set(auth(customer.token));
    expect(byId.status).toBe(200);
    expect(byId.body.data.ticketNumber).toBe(ticket.ticketNumber);

    const strangerById = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set(auth(stranger.token));
    expect(strangerById.status).toBe(403);
  });

  it("admin check-in: USED, double check-in 409, wrong event 404, lookup authz", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token);
    const otherEvent = await createEvent(admin.token);
    const { ticket } = await customerWithTicket(event.id, admin.token);

    // Lookup works for admin, forbidden for customers.
    const lookup = await request(app)
      .get(`/api/tickets/lookup?ticketNumber=${ticket.ticketNumber}`)
      .set(auth(admin.token));
    expect(lookup.status).toBe(200);
    expect(lookup.body.data.ticketNumber).toBe(ticket.ticketNumber);

    const customerLookup = await request(app)
      .get(`/api/tickets/lookup?ticketNumber=${ticket.ticketNumber}`)
      .set(auth((await registerAndLogin("tick-lu")).token));
    expect(customerLookup.status).toBe(403);

    // Check-in against the wrong event → not found there.
    const wrongEvent = await request(app)
      .post("/api/tickets/check-in")
      .set(auth(admin.token))
      .send({ ticketNumber: ticket.ticketNumber, eventId: otherEvent.id });
    expect(wrongEvent.status).toBe(404);

    const checkIn = await request(app)
      .post("/api/tickets/check-in")
      .set(auth(admin.token))
      .send({ ticketNumber: ticket.ticketNumber, eventId: event.id });
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.data.status).toBe("USED");
    expect(checkIn.body.data.usedAt).toBeTruthy();

    const second = await request(app)
      .post("/api/tickets/check-in")
      .set(auth(admin.token))
      .send({ ticketNumber: ticket.ticketNumber, eventId: event.id });
    expect(second.status).toBe(409);
  });

  it("attendee stats are consistent; search filter works; CSV export works", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { capacity: 5 });

    const first = await customerWithTicket(event.id, admin.token, "tick-alice");
    const second = await customerWithTicket(event.id, admin.token, "tick-bob");

    // Check in the first ticket.
    const checkIn = await request(app)
      .post("/api/tickets/check-in")
      .set(auth(admin.token))
      .send({ ticketNumber: first.ticket.ticketNumber, eventId: event.id });
    expect(checkIn.status).toBe(200);

    const attendees = await request(app)
      .get(`/api/events/${event.id}/attendees`)
      .set(auth(admin.token));
    expect(attendees.status).toBe(200);
    expect(attendees.body.data.stats).toMatchObject({
      capacity: 5,
      reserved: 0,
      confirmed: 2,
      used: 1,
      remaining: 3,
    });
    expect(attendees.body.data.result.meta.total).toBe(2);

    // Search by customer name narrows the list.
    const search = await request(app)
      .get(
        `/api/events/${event.id}/attendees?search=${encodeURIComponent(
          first.customer.user.name ?? "",
        )}`,
      )
      .set(auth(admin.token));
    expect(search.status).toBe(200);
    expect(search.body.data.result.meta.total).toBe(1);
    expect(search.body.data.result.items[0].ticketNumber).toBe(
      first.ticket.ticketNumber,
    );

    // Search by ticket number also works.
    const byTicketNumber = await request(app)
      .get(
        `/api/events/${event.id}/attendees?search=${encodeURIComponent(
          second.ticket.ticketNumber as string,
        )}`,
      )
      .set(auth(admin.token));
    expect(byTicketNumber.body.data.result.meta.total).toBe(1);

    // CSV export.
    const csv = await request(app)
      .get(`/api/events/${event.id}/attendees/export`)
      .set(auth(admin.token));
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    const firstLine = (csv.text as string).split("\n")[0];
    expect(firstLine).toBe(
      "Ticket Number,Name,Email,Phone,Status,Checked In At,Purchase Date",
    );
    expect(csv.text).toContain(first.customer.user.email);
  });

  it("expired reservation: request EXPIRED, payment FAILED, capacity released", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const event = await createEvent(admin.token, { capacity: 3 });
    const customer = await registerAndLogin("tick-expire");

    const created = await requestTicket(customer.token, event.id);
    const requestId = created.body.data.id;
    expect((await approveRequest(admin.token, requestId)).status).toBe(200);

    const payment = await request(app)
      .post("/api/payments")
      .set(auth(customer.token))
      .send({ ticketRequestId: requestId });
    expect(payment.status).toBe(201);

    // While the reservation is live it occupies a place.
    const before = await request(app).get(`/api/events/${event.id}`);
    expect(before.body.data.available).toBe(2);

    // Age the reservation beyond the payment window (default 30 min).
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.ticketRequest.update({
      where: { id: requestId },
      data: { reviewedAt: twoHoursAgo },
    });

    // This endpoint runs the expiration sweep before listing.
    const pending = await request(app)
      .get("/api/ticket-requests/my/payment-pending")
      .set(auth(customer.token));
    expect(pending.status).toBe(200);
    expect(pending.body.data).toHaveLength(0);

    const requestFromDb = await prisma.ticketRequest.findUnique({
      where: { id: requestId },
    });
    expect(requestFromDb!.status).toBe("EXPIRED");

    const paymentFromDb = await prisma.payment.findUnique({
      where: { id: payment.body.data.id },
    });
    expect(paymentFromDb!.status).toBe("FAILED");

    // The place is released again.
    const after = await request(app).get(`/api/events/${event.id}`);
    expect(after.body.data.available).toBe(3);
    expect(after.body.data.occupied).toBe(0);
  });
});
