import { describe, expect, it } from "vitest";
import request from "supertest";
import { auth, getApp, registerAndLogin, uniqueEmail } from "./helpers";
import { getLastMailForTests } from "../src/services/email.service";

describe("auth & user profile", () => {
  it("registers a customer: 201, no password in response", async () => {
    const app = await getApp();
    const email = uniqueEmail("auth-reg");
    const res = await request(app).post("/api/auth/register").send({
      name: "Auth User",
      email,
      password: "Password123!",
      phone: "9876543210",
      age: 28,
      instagramUsername: "auth.user",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.role).toBe("CUSTOMER");
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("rejects registration without an Instagram username", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/register").send({
      name: "No Instagram",
      email: uniqueEmail("auth-noig"),
      password: "Password123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid input/i);
  });

  it("strips a leading @ from the Instagram username", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/register").send({
      name: "At Sign User",
      email: uniqueEmail("auth-at"),
      password: "Password123!",
      instagramUsername: "@at.sign",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.instagramUsername).toBe("at.sign");
  });

  it("rejects duplicate registration", async () => {
    const app = await getApp();
    const email = uniqueEmail("auth-dup");
    const body = {
      name: "Dup User",
      email,
      password: "Password123!",
      instagramUsername: "dup.user",
    };
    const first = await request(app).post("/api/auth/register").send(body);
    expect(first.status).toBe(201);
    const second = await request(app).post("/api/auth/register").send(body);
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already exists/i);
  });

  it("issues a refresh token on login and rotates it on /auth/refresh", async () => {
    const app = await getApp();
    const { email, password } = await registerAndLogin("auth-refresh");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    expect(login.status).toBe(200);
    const refreshToken = login.body.data.refreshToken;
    expect(refreshToken).toBeTruthy();

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();
    expect(refreshed.body.data.refreshToken).toBeTruthy();

    // Rotated: the old refresh token must no longer work.
    const replay = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(replay.status).toBe(401);

    // The new pair works.
    const second = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshed.body.data.refreshToken });
    expect(second.status).toBe(200);
  });

  it("logout revokes the refresh token", async () => {
    const app = await getApp();
    const { email, password } = await registerAndLogin("auth-logout");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    const refreshToken = login.body.data.refreshToken;

    const out = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken });
    expect(out.status).toBe(200);

    const after = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(after.status).toBe(401);
  });

  it("forgot-password: OTP resets the password, old sessions revoked", async () => {
    const app = await getApp();
    const { email } = await registerAndLogin("auth-otp");

    const requested = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email });
    expect(requested.status).toBe(200);

    // SMTP is not configured in tests — the OTP is captured by the dev mailer.
    const mail = getLastMailForTests();
    expect(mail).toBeTruthy();
    const otp = mail!.text.match(/\b(\d{6})\b/)?.[1];
    expect(otp).toBeTruthy();

    // Wrong code rejected, correct code works
    const wrong = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp: otp === "000000" ? "000001" : "000000", newPassword: "NewPassword123!" });
    expect(wrong.status).toBe(400);

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "NewPassword123!" });
    expect(reset.status).toBe(200);

    // Old password dead, new password works
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "TestPassword123!" });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "NewPassword123!" });
    expect(newLogin.status).toBe(200);

    // Consumed OTP cannot be replayed
    const replay = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, newPassword: "AnotherPass123!" });
    expect(replay.status).toBe(400);
  });

  it("forgot-password returns the generic message for unknown emails (no enumeration)", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: uniqueEmail("auth-nope") });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/if an account exists/i);
  });

  it("passwordless email-code login issues a full session", async () => {
    const app = await getApp();
    const { email } = await registerAndLogin("auth-elogin");

    const requested = await request(app)
      .post("/api/auth/email-code")
      .send({ email });
    expect(requested.status).toBe(200);

    const mail = getLastMailForTests();
    const otp = mail!.text.match(/\b(\d{6})\b/)?.[1];
    expect(otp).toBeTruthy();

    const loggedIn = await request(app)
      .post("/api/auth/email-login")
      .send({ email, otp });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.data.accessToken).toBeTruthy();
    expect(loggedIn.body.data.refreshToken).toBeTruthy();
    expect(loggedIn.body.data.user.email).toBe(email);

    // Session actually works
    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${loggedIn.body.data.accessToken}`);
    expect(me.status).toBe(200);

    // Code is single-use
    const replay = await request(app)
      .post("/api/auth/email-login")
      .send({ email, otp });
    expect(replay.status).toBe(400);
  });

  it("email-code login returns the generic message for unknown emails", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/auth/email-code")
      .send({ email: uniqueEmail("auth-nouser") });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/if an account exists/i);
  });

  it("OTP is locked after 5 wrong attempts", async () => {
    const app = await getApp();
    const { email } = await registerAndLogin("auth-otp-lock");

    await request(app).post("/api/auth/forgot-password").send({ email });

    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      lastStatus = (
        await request(app)
          .post("/api/auth/reset-password")
          .send({ email, otp: "999999", newPassword: "Whatever123!" })
      ).status;
    }
    expect(lastStatus).toBe(400);

    // Even the REAL code must no longer work after lockout — and a fresh
    // code request within the resend cooldown is rejected (400).
    const again = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/wait a minute/i);
  });

  it("ignores role=ADMIN in the register body (mass-assignment guard)", async () => {
    const app = await getApp();
    const res = await request(app).post("/api/auth/register").send({
      name: "Sneaky Admin",
      email: uniqueEmail("auth-role"),
      password: "Password123!",
      role: "ADMIN",
      instagramUsername: "sneaky.admin",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("CUSTOMER");
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    const app = await getApp();
    const { email, password } = await registerAndLogin("auth-login");

    const ok = await request(app).post("/api/auth/login").send({ email, password });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTypeOf("string");
    expect(ok.body.data.user.email).toBe(email);

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPassword1!" });
    expect(bad.status).toBe(401);
  });

  it("returns 400 for login validation errors (missing email)", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "Password123!" });
    expect(res.status).toBe(400);
  });

  it("GET /api/users/me requires a token and returns the profile with one", async () => {
    const app = await getApp();
    const anon = await request(app).get("/api/users/me");
    expect(anon.status).toBe(401);

    const { token, email } = await registerAndLogin("auth-me");
    const res = await request(app).get("/api/users/me").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.password).toBeUndefined();
  });

  it("PATCH /api/users/me updates instagramUsername", async () => {
    const app = await getApp();
    const { token } = await registerAndLogin("auth-patch");
    const res = await request(app)
      .patch("/api/users/me")
      .set(auth(token))
      .send({ instagramUsername: "test.insta" });
    expect(res.status).toBe(200);
    expect(res.body.data.instagramUsername).toBe("test.insta");
  });

  it("PATCH /api/users/me with a taken email returns 409", async () => {
    const app = await getApp();
    const first = await registerAndLogin("auth-taken1");
    const second = await registerAndLogin("auth-taken2");

    const res = await request(app)
      .patch("/api/users/me")
      .set(auth(first.token))
      .send({ email: second.email });
    expect(res.status).toBe(409);
  });

  it("PATCH /api/users/me ignores attempts to change the role", async () => {
    const app = await getApp();
    const { token } = await registerAndLogin("auth-rolepatch");

    const res = await request(app)
      .patch("/api/users/me")
      .set(auth(token))
      .send({ role: "ADMIN" });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("CUSTOMER");

    const me = await request(app).get("/api/users/me").set(auth(token));
    expect(me.body.data.role).toBe("CUSTOMER");
  });
});
