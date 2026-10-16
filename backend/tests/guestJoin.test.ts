import { describe, expect, it } from "vitest";
import request from "supertest";
import { getApp, loginAdmin, registerAndLogin, uniqueEmail } from "./helpers";
import prisma from "../src/config/prisma";
import { getLastMailForTests } from "../src/services/email.service";

async function createPublishedEvent(token: string) {
  const app = await getApp();
  const event = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Guest Join Test Event",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      venue: "Guest Park",
      ticketPrice: 250,
      capacity: 10,
    });
  await request(app)
    .patch(`/api/events/${event.body.data.id}/publish`)
    .set("Authorization", `Bearer ${token}`);
  return event.body.data.id as string;
}

describe("guest request-to-join flow (no customer accounts)", () => {
  it("full flow: guest join → auto account → approve+email → invite pay → ticket → congrats email", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const eventId = await createPublishedEvent(admin.token);

    const email = uniqueEmail("guest");

    // 1. Guest submits the join form (no auth header at all)
    const joined = await request(app)
      .post("/api/ticket-requests/guest")
      .send({
        eventId,
        name: "Guest User",
        email,
        phone: "9876543210",
        instagramUsername: "guest.user",
        linkedinProfileUrl: "https://linkedin.com/in/guestuser",
        age: 27,
      });
    expect(joined.status).toBe(201);
    const browserToken = joined.body.data.inviteToken;
    expect(browserToken).toBeTruthy();

    // 2. Account auto-created with a random (unknowable) password
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();
    expect(user!.role).toBe("CUSTOMER");
    expect(user!.instagramUsername).toBe("guest.user");
    expect(user!.linkedinProfileUrl).toBe("https://linkedin.com/in/guestuser");
    const guessLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "TestPassword123!" });
    expect(guessLogin.status).toBe(401);

    // 3. Re-submitting the same email + event reports alreadyExists WITHOUT
    //    killing the original browser's token (inviteToken stays null when
    //    an invite already exists — the hash is all we store)
    const dup = await request(app)
      .post("/api/ticket-requests/guest")
      .send({
        eventId,
        name: "Guest User",
        email,
        phone: "9876543210",
        instagramUsername: "guest.user",
        age: 27,
      });
    expect(dup.status).toBe(201);
    expect(dup.body.data.alreadyExists).toBe(true);
    expect(dup.body.data.inviteToken).toBeFalsy();

    // The ORIGINAL token still works
    const stillValid = await request(app).get(`/api/invites/${browserToken}`);
    expect(stillValid.status).toBe(200);

    // 4. Admin approves → approval email sent; the BROWSER's token keeps
    //    working unchanged
    const adminRequests = await request(app)
      .get(`/api/ticket-requests/admin?eventId=${eventId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    const requestId = adminRequests.body.data.items[0].id;

    const approved = await request(app)
      .patch(`/api/ticket-requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("PAYMENT_PENDING");

    const approvalMail = getLastMailForTests();
    expect(approvalMail?.to).toBe(email);
    expect(approvalMail?.text).toMatch(/approved/i);
    const token = browserToken;

    // 5. Invite state: payable
    const state = await request(app).get(`/api/invites/${token}`);
    expect(state.status).toBe(200);
    expect(state.body.data.status).toBe("PAYMENT_PENDING");
    expect(state.body.data.reservationValid).toBe(true);
    expect(state.body.data.event.title).toBe("Guest Join Test Event");

    // 6. Invite pay creates the payment (no Razorpay in tests → order null)
    const pay = await request(app).post(`/api/invites/${token}/pay`);
    expect(pay.status).toBe(200);
    expect(pay.body.data.payment.status).toBe("PENDING");

    // 7. Dev-complete (non-production) fulfills → ticket + congrats email
    const done = await request(app).post(`/api/invites/${token}/dev-complete`);
    expect(done.status).toBe(200);
    expect(done.body.data.ticket.ticketNumber).toBeTruthy();

    const finalState = await request(app).get(`/api/invites/${token}`);
    expect(finalState.body.data.status).toBe("PAID");
    expect(finalState.body.data.ticket.status).toBe("ACTIVE");
    expect(finalState.body.data.reservationValid).toBe(false);

    const congrats = getLastMailForTests();
    expect(congrats?.to).toBe(email);
    expect(congrats?.text).toMatch(/ticket number/i);
    expect(congrats?.text).toMatch(
      new RegExp(done.body.data.ticket.ticketNumber),
    );
  });

  it("guest join validation: instagram, phone and age are required", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const eventId = await createPublishedEvent(admin.token);

    const res = await request(app)
      .post("/api/ticket-requests/guest")
      .send({ eventId, name: "No IG", email: uniqueEmail("guest-noig") });
    expect(res.status).toBe(400);
    expect(
      Object.keys(res.body.errors.fieldErrors),
    ).toEqual(expect.arrayContaining(["phone", "instagramUsername", "age"]));
  });

  it("unknown or expired invite tokens are rejected", async () => {
    const app = await getApp();
    const missing = await request(app).get("/api/invites/doesnotexist");
    expect(missing.status).toBe(404);
  });

  it("existing customer profile is refreshed on repeat guest join for another event", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const eventA = await createPublishedEvent(admin.token);
    const eventB = await createPublishedEvent(admin.token);
    const email = uniqueEmail("guest-repeat");

    await request(app)
      .post("/api/ticket-requests/guest")
      .send({
        eventId: eventA,
        name: "Repeat Guest",
        email,
        phone: "9876543210",
        instagramUsername: "repeat.one",
        age: 30,
      });

    const second = await request(app)
      .post("/api/ticket-requests/guest")
      .send({
        eventId: eventB,
        name: "Repeat Guest",
        email,
        phone: "9123456789",
        instagramUsername: "repeat.two",
        age: 31,
      });
    expect(second.status).toBe(201);

    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
    expect(users[0].instagramUsername).toBe("repeat.two");
  });

  it("unauthenticated legacy request endpoint still requires a customer token", async () => {
    const app = await getApp();
    const admin = await loginAdmin();
    const eventId = await createPublishedEvent(admin.token);

    const res = await request(app)
      .post("/api/ticket-requests")
      .send({ eventId });
    expect(res.status).toBe(401);

    const customer = await registerAndLogin("legacy-customer");
    const okRes = await request(app)
      .post("/api/ticket-requests")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({ eventId });
    expect(okRes.status).toBe(201);
  });
});
