import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import UserAvatar from "../src/models/UserAvatar.js";

describe("profile contract", () => {
  it("requires authentication to update the profile", async () => {
    const response = await request(app)
      .patch("/api/v1/profile")
      .send({ name: "Novo nome" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_TOKEN_REQUIRED");
  });
});

const hasTestDatabase = Boolean(process.env.TEST_MONGO_URI);
const integration = hasTestDatabase ? describe : describe.skip;

integration("profile integration", () => {
  let token;
  let user;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), UserAvatar.deleteMany({})]);
    user = await User.create({
      name: "Ana Silva",
      email: "ana@email.com",
      passwordHash: "hash-nao-utilizado",
    });
    token = jwt.sign({}, env.jwtSecret, {
      subject: user._id.toString(),
      expiresIn: "1h",
      algorithm: "HS256",
    });
  });

  afterAll(async () => {
    await Promise.all([User.deleteMany({}), UserAvatar.deleteMany({})]);
    await mongoose.disconnect();
  });

  it("updates only the authenticated user name", async () => {
    const response = await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "  Ana Atualizada  " });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: user._id.toString(),
      name: "Ana Atualizada",
      email: "ana@email.com",
      avatarUrl: null,
    });
    expect((await User.findById(user._id)).name).toBe("Ana Atualizada");
  });

  it("rejects invalid names and server-controlled fields", async () => {
    const invalidName = await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "A" });
    const forbiddenField = await request(app)
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Ana", email: "outro@email.com" });

    expect(invalidName.status).toBe(422);
    expect(invalidName.body.error.code).toBe("VALIDATION_ERROR");
    expect(forbiddenField.status).toBe(422);
    expect(forbiddenField.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("uploads, serves and replaces the avatar without duplicating it", async () => {
    const firstImage = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
    ]);
    const secondImage = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);

    const upload = await request(app)
      .put("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "image/png")
      .send(firstImage);

    expect(upload.status).toBe(200);
    expect(upload.body.data.avatarUrl).toMatch(
      new RegExp(`^/api/v1/profile/avatars/${user._id}\\?v=\\d+$`),
    );

    const avatarResponse = await request(app).get(upload.body.data.avatarUrl);
    expect(avatarResponse.status).toBe(200);
    expect(avatarResponse.headers["content-type"]).toBe("image/png");
    expect(avatarResponse.headers["cross-origin-resource-policy"]).toBe(
      "cross-origin",
    );
    expect(avatarResponse.body).toEqual(firstImage);

    const replacement = await request(app)
      .put("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "image/jpeg")
      .send(secondImage);

    expect(replacement.status).toBe(200);
    expect(await UserAvatar.countDocuments({ user: user._id })).toBe(1);
    const storedAvatar = await UserAvatar.findOne({ user: user._id });
    expect(storedAvatar.contentType).toBe("image/jpeg");
    expect(Buffer.from(storedAvatar.data)).toEqual(secondImage);
  });

  it("rejects unsupported or forged image content", async () => {
    const unsupported = await request(app)
      .put("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/plain")
      .send("not an image");
    const forged = await request(app)
      .put("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "image/png")
      .send(Buffer.from("not a png"));

    expect(unsupported.status).toBe(415);
    expect(unsupported.body.error.code).toBe("UNSUPPORTED_IMAGE_TYPE");
    expect(forged.status).toBe(415);
    expect(forged.body.error.code).toBe("UNSUPPORTED_IMAGE_TYPE");
  });

  it("rejects avatars larger than two megabytes", async () => {
    const image = Buffer.alloc(2 * 1024 * 1024 + 1);
    image.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const response = await request(app)
      .put("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "image/png")
      .send(image);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("AVATAR_TOO_LARGE");
  });

  it("removes the current avatar", async () => {
    const image = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
    ]);
    await request(app)
      .put("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "image/png")
      .send(image);

    const response = await request(app)
      .delete("/api/v1/profile/avatar")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.avatarUrl).toBeNull();
    expect(await UserAvatar.countDocuments({ user: user._id })).toBe(0);
  });
});
