import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import app from "../app.js";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Game from "../src/models/Game.js";
import QueueItem from "../src/models/QueueItem.js";

const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;

integration("games integration", () => {
  let mongoose;

  beforeAll(async () => {
    mongoose = await import("mongoose");
    await mongoose.default.connect(process.env.TEST_MONGO_URI);
  });

  afterEach(async () => {
    await QueueItem.deleteMany({});
    await Game.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.default.disconnect();
  });

  async function createAuthenticatedUser(name, email) {
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash("SenhaForte123", 4),
    });
    const token = jwt.sign({}, env.jwtSecret, {
      subject: user._id.toString(),
      expiresIn: "1h",
      algorithm: "HS256",
    });
    return { user, token };
  }

  it("requires authentication and validates controlled fields", async () => {
    const unauthenticated = await request(app)
      .post("/api/v1/games")
      .send({ title: "It Takes Two", platforms: ["PC"] });
    expect(unauthenticated.status).toBe(401);

    const { user, token } = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const invalid = await request(app)
      .post("/api/v1/games")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "It Takes Two",
        platforms: ["PC"],
        createdBy: user._id,
        isActive: false,
        normalizedTitle: "it takes two",
      });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a game using the authenticated user as author", async () => {
    const { user, token } = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const response = await request(app)
      .post("/api/v1/games")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: " It Takes Two ",
        platforms: ["PC", "PlayStation"],
        maxPlayers: 2,
        coverUrl: "https://example.com/cover.jpg",
        description: "Cooperativo",
      });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      title: "It Takes Two",
      platforms: ["PC", "PlayStation"],
      maxPlayers: 2,
      createdById: user._id.toString(),
      isActive: true,
    });
    expect(
      await Game.exists({ _id: response.body.data.id, createdBy: user._id }),
    ).toBeTruthy();
  });

  it("rejects duplicated normalized titles", async () => {
    const { token } = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const first = await request(app)
      .post("/api/v1/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Portal 2", platforms: ["PC"] });
    const duplicate = await request(app)
      .post("/api/v1/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "  portal   2  ", platforms: ["Switch"] });
    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("GAME_ALREADY_EXISTS");
    expect(await Game.countDocuments({})).toBe(1);
  });

  it("protects normalized titles with a unique database index", async () => {
    await Game.init();
    const indexes = await Game.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { normalizedTitle: 1 }, unique: true }),
      ]),
    );
  });

  it("rejects updates that collide with another normalized title", async () => {
    const { user, token } = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const first = await Game.create({
      title: "Portal 2",
      normalizedTitle: "portal 2",
      platforms: ["PC"],
      createdBy: user._id,
    });
    const second = await Game.create({
      title: "Overcooked",
      normalizedTitle: "overcooked",
      platforms: ["PC"],
      createdBy: user._id,
    });
    const response = await request(app)
      .patch(`/api/v1/games/${second._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: " PORTAL  2 " });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("GAME_ALREADY_EXISTS");
    expect((await Game.findById(first._id)).title).toBe("Portal 2");
    expect((await Game.findById(second._id)).title).toBe("Overcooked");
  });

  it("lists only active games with search, platform and pagination", async () => {
    const { user, token } = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    await Game.create([
      {
        title: "Portal 2",
        normalizedTitle: "portal 2",
        platforms: ["PC"],
        maxPlayers: 2,
        createdBy: user._id,
      },
      {
        title: "Portal Knights",
        normalizedTitle: "portal knights",
        platforms: ["PC", "Switch"],
        createdBy: user._id,
      },
      {
        title: "Inactive Portal",
        normalizedTitle: "inactive portal",
        platforms: ["PC"],
        createdBy: user._id,
        isActive: false,
      },
      {
        title: "Overcooked",
        normalizedTitle: "overcooked",
        platforms: ["PlayStation"],
        createdBy: user._id,
      },
    ]);
    const response = await request(app)
      .get("/api/v1/games?search=portal&platform=PC&page=1&limit=1")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.games).toHaveLength(1);
    expect(response.body.data.meta).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it("returns details only for active games and validates ids", async () => {
    const { user, token } = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const game = await Game.create({
      title: "Portal 2",
      normalizedTitle: "portal 2",
      platforms: ["PC"],
      createdBy: user._id,
      isActive: false,
    });
    const inactive = await request(app)
      .get(`/api/v1/games/${game._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(inactive.status).toBe(404);
    expect(inactive.body.error.code).toBe("GAME_NOT_FOUND");
    const invalid = await request(app)
      .get("/api/v1/games/invalid-id")
      .set("Authorization", `Bearer ${token}`);
    expect(invalid.status).toBe(422);
  });

  it("allows only the author to update a game", async () => {
    const author = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const other = await createAuthenticatedUser(
      "Other User",
      "other@example.com",
    );
    const game = await Game.create({
      title: "Portal 2",
      normalizedTitle: "portal 2",
      platforms: ["PC"],
      createdBy: author.user._id,
    });
    const forbidden = await request(app)
      .patch(`/api/v1/games/${game._id}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ title: "Changed" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("GAME_AUTHOR_REQUIRED");
    const updated = await request(app)
      .patch(`/api/v1/games/${game._id}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ title: "Portal Two", maxPlayers: 2 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      title: "Portal Two",
      maxPlayers: 2,
    });
  });

  it("soft deletes a game without removing queue references", async () => {
    const author = await createAuthenticatedUser(
      "Game Author",
      "author@example.com",
    );
    const game = await Game.create({
      title: "Portal 2",
      normalizedTitle: "portal 2",
      platforms: ["PC"],
      createdBy: author.user._id,
    });
    const queueItem = await QueueItem.create({
      group: new mongoose.default.Types.ObjectId(),
      game: game._id,
      suggestedBy: author.user._id,
    });
    const response = await request(app)
      .delete(`/api/v1/games/${game._id}`)
      .set("Authorization", `Bearer ${author.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: game._id.toString(),
      isActive: false,
    });
    expect((await Game.findById(game._id)).isActive).toBe(false);
    expect(
      await QueueItem.exists({ _id: queueItem._id, game: game._id }),
    ).toBeTruthy();
  });
});
