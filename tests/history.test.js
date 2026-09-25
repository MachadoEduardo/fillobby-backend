import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import app from "../app.js";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import Group from "../src/models/Group.js";
import GroupMember from "../src/models/GroupMember.js";
import Game from "../src/models/Game.js";
import QueueItem from "../src/models/QueueItem.js";
import Vote from "../src/models/Vote.js";

const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;

integration("history integration", () => {
  let mongoose;
  let sequence = 0;

  beforeAll(async () => {
    mongoose = await import("mongoose");
    await mongoose.default.connect(process.env.TEST_MONGO_URI);
  });

  afterEach(async () => {
    await Vote.deleteMany({});
    await QueueItem.deleteMany({});
    await Game.deleteMany({});
    await GroupMember.deleteMany({});
    await Group.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.default.disconnect();
  });

  async function createUser(name, group, status = "ACTIVE") {
    sequence += 1;
    const user = await User.create({
      name,
      email: `history-${sequence}@example.com`,
      passwordHash: await bcrypt.hash("SenhaForte123", 4),
    });
    const token = jwt.sign({}, env.jwtSecret, {
      subject: user._id.toString(),
      expiresIn: "1h",
      algorithm: "HS256",
    });

    if (group) {
      await GroupMember.create({
        group: group._id,
        user: user._id,
        role: "MEMBER",
        status,
      });
    }
    return { user, token };
  }

  async function createContext() {
    const owner = await createUser("History Owner");
    sequence += 1;
    const group = await Group.create({
      name: "History Group",
      owner: owner.user._id,
      inviteCode: `HISTORY${sequence}`,
    });
    await GroupMember.create({
      group: group._id,
      user: owner.user._id,
      role: "OWNER",
      status: "ACTIVE",
    });
    const first = await createUser("History Player One", group);
    const second = await createUser("History Player Two", group);
    const firstGame = await Game.create({
      title: `History Game One ${sequence}`,
      normalizedTitle: `history game one ${sequence}`,
      platforms: ["PC"],
      createdBy: owner.user._id,
    });
    const secondGame = await Game.create({
      title: `History Game Two ${sequence}`,
      normalizedTitle: `history game two ${sequence}`,
      platforms: ["Switch"],
      createdBy: owner.user._id,
    });

    return { owner, first, second, group, firstGame, secondGame };
  }

  function historyPath(groupId, query = "") {
    return `/api/v1/groups/${groupId}/history${query}`;
  }

  async function createItem({
    group,
    game,
    suggestedBy,
    participants = [],
    status = "COMPLETED",
    completedAt,
  }) {
    return QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: suggestedBy.user._id,
      participants: participants.map(({ user }) => user._id),
      readyUsers: participants.map(({ user }) => user._id),
      status,
      completedAt: completedAt ?? null,
    });
  }

  it("lists only completed items from the requested group, newest first", async () => {
    const context = await createContext();
    const older = await createItem({
      ...context,
      game: context.firstGame,
      suggestedBy: context.first,
      participants: [context.first],
      completedAt: new Date("2026-01-10T12:00:00.000Z"),
    });
    const newer = await createItem({
      ...context,
      game: context.secondGame,
      suggestedBy: context.second,
      participants: [context.first, context.second],
      completedAt: new Date("2026-01-11T12:00:00.000Z"),
    });
    await createItem({
      ...context,
      game: context.firstGame,
      suggestedBy: context.first,
      status: "CANCELLED",
    });
    context.secondGame.isActive = false;
    await context.secondGame.save();
    await GroupMember.updateOne(
      { group: context.group._id, user: context.second.user._id },
      { $set: { status: "REMOVED" } },
    );

    const otherContext = await createContext();
    await createItem({
      ...otherContext,
      game: otherContext.firstGame,
      suggestedBy: otherContext.first,
      completedAt: new Date("2026-01-12T12:00:00.000Z"),
    });

    const response = await request(app)
      .get(historyPath(context.group._id))
      .set("Authorization", `Bearer ${context.first.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.historyItems.map(({ id }) => id)).toEqual([
      newer._id.toString(),
      older._id.toString(),
    ]);
    expect(response.body.data.historyItems[0]).toMatchObject({
      status: "COMPLETED",
      game: { title: context.secondGame.title },
      participantIds: [context.first.user._id.toString(), context.second.user._id.toString()],
      participants: [
        {
          id: context.first.user._id.toString(),
          name: "History Player One",
          avatarUrl: null,
        },
        {
          id: context.second.user._id.toString(),
          name: "History Player Two",
          avatarUrl: null,
        },
      ],
    });
    expect(response.body.data.historyItems[0].suggestedBy.email).toBeUndefined();
  });

  it("requires authentication and an active group membership", async () => {
    const context = await createContext();
    const unauthenticated = await request(app).get(historyPath(context.group._id));
    expect(unauthenticated.status).toBe(401);

    const outsider = await createUser("History Outsider");
    const hidden = await request(app)
      .get(historyPath(context.group._id))
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(hidden.status).toBe(404);

    await GroupMember.updateOne(
      { group: context.group._id, user: context.first.user._id },
      { $set: { status: "REMOVED" } },
    );
    const removed = await request(app)
      .get(historyPath(context.group._id))
      .set("Authorization", `Bearer ${context.first.token}`);
    expect(removed.status).toBe(404);
  });

  it("paginates completed items with a maximum validated limit", async () => {
    const context = await createContext();
    await createItem({
      ...context,
      game: context.firstGame,
      suggestedBy: context.first,
      completedAt: new Date("2026-02-01T12:00:00.000Z"),
    });
    await createItem({
      ...context,
      game: context.secondGame,
      suggestedBy: context.first,
      completedAt: new Date("2026-02-02T12:00:00.000Z"),
    });

    const response = await request(app)
      .get(historyPath(context.group._id, "?page=2&limit=1"))
      .set("Authorization", `Bearer ${context.first.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.historyItems).toHaveLength(1);
    expect(response.body.data.meta).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });

    const excessive = await request(app)
      .get(historyPath(context.group._id, "?limit=101"))
      .set("Authorization", `Bearer ${context.first.token}`);
    expect(excessive.status).toBe(422);
  });

  it("filters history by game and participant", async () => {
    const context = await createContext();
    const expected = await createItem({
      ...context,
      game: context.firstGame,
      suggestedBy: context.first,
      participants: [context.first],
      completedAt: new Date("2026-03-01T12:00:00.000Z"),
    });
    await createItem({
      ...context,
      game: context.secondGame,
      suggestedBy: context.second,
      participants: [context.second],
      completedAt: new Date("2026-03-02T12:00:00.000Z"),
    });

    const query = `?gameId=${context.firstGame._id}` + `&participantId=${context.first.user._id}`;
    const response = await request(app)
      .get(historyPath(context.group._id, query))
      .set("Authorization", `Bearer ${context.first.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.historyItems).toHaveLength(1);
    expect(response.body.data.historyItems[0].id).toBe(expected._id.toString());
  });

  it("filters an inclusive UTC date range and validates its order", async () => {
    const context = await createContext();
    const expected = await createItem({
      ...context,
      game: context.firstGame,
      suggestedBy: context.first,
      completedAt: new Date("2026-04-10T23:59:59.999Z"),
    });
    await createItem({
      ...context,
      game: context.secondGame,
      suggestedBy: context.second,
      completedAt: new Date("2026-04-11T00:00:00.000Z"),
    });

    const response = await request(app)
      .get(historyPath(context.group._id, "?from=2026-04-10&to=2026-04-10"))
      .set("Authorization", `Bearer ${context.first.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.historyItems).toHaveLength(1);
    expect(response.body.data.historyItems[0].id).toBe(expected._id.toString());

    const reversed = await request(app)
      .get(historyPath(context.group._id, "?from=2026-04-11&to=2026-04-10"))
      .set("Authorization", `Bearer ${context.first.token}`);
    expect(reversed.status).toBe(422);

    const invalid = await request(app)
      .get(historyPath(context.group._id, "?from=2026-02-30"))
      .set("Authorization", `Bearer ${context.first.token}`);
    expect(invalid.status).toBe(422);
  });

  it("keeps a historical item immutable through common queue operations", async () => {
    const context = await createContext();
    const item = await createItem({
      ...context,
      game: context.firstGame,
      suggestedBy: context.first,
      completedAt: new Date("2026-05-01T12:00:00.000Z"),
    });

    const cancellation = await request(app)
      .delete(`/api/v1/groups/${context.group._id}/queue/${item._id}`)
      .set("Authorization", `Bearer ${context.owner.token}`);
    expect(cancellation.status).toBe(409);
    expect(cancellation.body.error.code).toBe("QUEUE_ITEM_IMMUTABLE");
    expect(await QueueItem.exists({ _id: item._id })).toBeTruthy();
  });
});
