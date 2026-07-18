import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import User from "../src/models/User.js";
import { serializeUser } from "../src/modules/auth/auth.service.js";

describe("auth contract", () => {
  it("serializes users without password fields", () => {
    const user = {
      _id: "507f1f77bcf86cd799439011",
      name: "Ana",
      email: "ana@email.com",
      passwordHash: "secret",
      avatarUrl: null,
    };
    expect(serializeUser(user)).toEqual({
      id: user._id,
      name: "Ana",
      email: "ana@email.com",
      avatarUrl: null,
    });
    expect(serializeUser(user)).not.toHaveProperty("passwordHash");
  });

  it("returns the standardized 404 response", async () => {
    const response = await request(app).get("/api/v1/unknown");
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("returns validation errors before accessing the database", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "invalido" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

const hasTestDatabase = Boolean(process.env.TEST_MONGO_URI);
const integration = hasTestDatabase ? describe : describe.skip;

integration("auth integration", () => {
  let mongoose;

  beforeAll(async () => {
    mongoose = await import("mongoose");
    await mongoose.default.connect(process.env.TEST_MONGO_URI);
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.default.disconnect();
  });

  it("registers and logs in a user, then reads /me", async () => {
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Ana Silva",
        email: "ANA@EMAIL.COM",
        password: "SenhaForte123",
      });
    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toBeUndefined();
    expect(registration.body.data.email).toBe("ana@email.com");

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ana@email.com", password: "SenhaForte123" });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("ana@email.com");
    expect(me.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects duplicate emails and invalid credentials", async () => {
    const payload = {
      name: "Ana Silva",
      email: "ana@email.com",
      password: "SenhaForte123",
    };
    await request(app).post("/api/v1/auth/register").send(payload);
    const duplicate = await request(app)
      .post("/api/v1/auth/register")
      .send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_EXISTS");

    const invalid = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: "Errada123" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
