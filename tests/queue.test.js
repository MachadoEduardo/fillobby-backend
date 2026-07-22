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

integration("queue integration", () => {
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

  async function createUser(name, role, group) {
    sequence += 1;
    const user = await User.create({
      name,
      email: `queue-${sequence}@example.com`,
      passwordHash: await bcrypt.hash("SenhaForte123", 4),
    });
    const token = jwt.sign({}, env.jwtSecret, {
      subject: user._id.toString(),
      expiresIn: "1h",
      algorithm: "HS256",
    });
    if (group)
      await GroupMember.create({
        group: group._id,
        user: user._id,
        role,
        status: "ACTIVE",
      });
    return { user, token };
  }

  async function createContext() {
    const owner = await createUser("Queue Owner");
    sequence += 1;
    const group = await Group.create({
      name: "Queue Group",
      owner: owner.user._id,
      inviteCode: `QUEUE${sequence}`,
    });
    await GroupMember.create({
      group: group._id,
      user: owner.user._id,
      role: "OWNER",
      status: "ACTIVE",
    });
    const member = await createUser("Queue Member", "MEMBER", group);
    const game = await Game.create({
      title: "Portal 2",
      normalizedTitle: `portal 2 ${sequence}`,
      platforms: ["PC"],
      maxPlayers: 2,
      createdBy: owner.user._id,
    });
    return { owner, member, group, game };
  }

  it("requires an active membership and rejects server-controlled fields", async () => {
    const { group, game } = await createContext();
    const outsider = await createUser("Queue Outsider");
    const hidden = await request(app)
      .post(`/api/v1/groups/${group._id}/queue`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ gameId: game._id });
    expect(hidden.status).toBe(404);
    const invalid = await request(app)
      .post(`/api/v1/groups/${group._id}/queue`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ gameId: game._id, initialStatus: "VOTING" });
    expect(invalid.status).toBe(422);
  });

  it("creates a SUGGESTED item for an active game and member", async () => {
    const { member, group, game } = await createContext();
    const response = await request(app)
      .post(`/api/v1/groups/${group._id}/queue`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ gameId: game._id });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      groupId: group._id.toString(),
      status: "SUGGESTED",
      voteCount: 0,
      suggestedBy: { id: member.user._id.toString() },
    });
    expect(response.body.data.game).toMatchObject({
      id: game._id.toString(),
      title: "Portal 2",
    });
  });

  it("rejects inactive games and duplicate active queue items", async () => {
    const { member, group, game } = await createContext();
    await request(app)
      .post(`/api/v1/groups/${group._id}/queue`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ gameId: game._id });
    const duplicate = await request(app)
      .post(`/api/v1/groups/${group._id}/queue`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ gameId: game._id });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("QUEUE_ITEM_ALREADY_EXISTS");
    game.isActive = false;
    await game.save();
    const otherGroup = await Group.create({
      name: "Other Group",
      owner: member.user._id,
      inviteCode: `OTHER${sequence}`,
    });
    await GroupMember.create({
      group: otherGroup._id,
      user: member.user._id,
      role: "OWNER",
    });
    const inactive = await request(app)
      .post(`/api/v1/groups/${otherGroup._id}/queue`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ gameId: game._id });
    expect(inactive.status).toBe(404);
    expect(inactive.body.error.code).toBe("GAME_NOT_FOUND");
  });

  it("protects active duplicates with a unique database index", async () => {
    await QueueItem.init();
    const indexes = await QueueItem.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { group: 1, game: 1 }, unique: true }),
      ]),
    );
  });

  it("lists active items with filters, ranking and pagination", async () => {
    const { member, group, game, owner } = await createContext();
    const secondGame = await Game.create({
      title: "Overcooked",
      normalizedTitle: `overcooked ${sequence}`,
      platforms: ["PlayStation"],
      createdBy: owner.user._id,
    });
    await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: member.user._id,
      status: "VOTING",
      voteCount: 1,
    });
    await QueueItem.create({
      group: group._id,
      game: secondGame._id,
      suggestedBy: member.user._id,
      status: "VOTING",
      voteCount: 3,
    });
    const response = await request(app)
      .get(
        `/api/v1/groups/${group._id}/queue?status=VOTING&search=over&platform=PlayStation&page=1&limit=10&sort=votes_desc`,
      )
      .set("Authorization", `Bearer ${member.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.queueItems).toHaveLength(1);
    expect(response.body.data.queueItems[0]).toMatchObject({
      voteCount: 3,
      game: { title: "Overcooked" },
    });
    expect(response.body.data.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("details only active items belonging to the requested group", async () => {
    const { member, group, game } = await createContext();
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: member.user._id,
    });
    const detail = await request(app)
      .get(`/api/v1/groups/${group._id}/queue/${item._id}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(detail.status).toBe(200);
    const otherGroup = await Group.create({
      name: "Other Group",
      owner: member.user._id,
      inviteCode: `DETAIL${sequence}`,
    });
    await GroupMember.create({
      group: otherGroup._id,
      user: member.user._id,
      role: "OWNER",
    });
    const hidden = await request(app)
      .get(`/api/v1/groups/${otherGroup._id}/queue/${item._id}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe("QUEUE_ITEM_NOT_FOUND");
  });

  it("enforces administrative and valid status transitions", async () => {
    const { owner, member, group, game } = await createContext();
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: member.user._id,
    });
    const forbidden = await request(app)
      .patch(`/api/v1/groups/${group._id}/queue/${item._id}/status`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ status: "VOTING" });
    expect(forbidden.status).toBe(403);
    const voting = await request(app)
      .patch(`/api/v1/groups/${group._id}/queue/${item._id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "VOTING" });
    expect(voting.status).toBe(200);
    expect(voting.body.data.status).toBe("VOTING");
    const invalid = await request(app)
      .patch(`/api/v1/groups/${group._id}/queue/${item._id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "PLAYING" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUEUE_TRANSITION");
  });

  it("starts, completes and timestamps an item through valid administrative transitions", async () => {
    const { owner, member, group, game } = await createContext();
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: member.user._id,
      status: "READY",
      participants: [member.user._id],
      readyUsers: [member.user._id],
    });
    const playing = await request(app)
      .patch(`/api/v1/groups/${group._id}/queue/${item._id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "PLAYING" });
    expect(playing.status).toBe(200);
    expect(playing.body.data.completedAt).toBeNull();
    const completed = await request(app)
      .patch(`/api/v1/groups/${group._id}/queue/${item._id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "COMPLETED" });
    expect(completed.status).toBe(200);
    expect(completed.body.data.completedAt).toEqual(expect.any(String));
  });

  it("cancels active items without deleting them and allows a future suggestion", async () => {
    const { owner, member, group, game } = await createContext();
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: member.user._id,
      status: "VOTING",
    });
    const forbidden = await request(app)
      .delete(`/api/v1/groups/${group._id}/queue/${item._id}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(forbidden.status).toBe(403);
    const cancelled = await request(app)
      .delete(`/api/v1/groups/${group._id}/queue/${item._id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    expect(await QueueItem.exists({ _id: item._id })).toBeTruthy();
    const recreated = await request(app)
      .post(`/api/v1/groups/${group._id}/queue`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ gameId: game._id });
    expect(recreated.status).toBe(201);
  });

  it("keeps COMPLETED and CANCELLED items immutable", async () => {
    const { owner, member, group, game } = await createContext();
    const completed = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: member.user._id,
      status: "COMPLETED",
      completedAt: new Date(),
    });
    const transition = await request(app)
      .patch(`/api/v1/groups/${group._id}/queue/${completed._id}/status`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "VOTING" });
    expect(transition.status).toBe(409);
    expect(transition.body.error.code).toBe("QUEUE_ITEM_IMMUTABLE");
    const cancellation = await request(app)
      .delete(`/api/v1/groups/${group._id}/queue/${completed._id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(cancellation.status).toBe(409);
    expect(cancellation.body.error.code).toBe("QUEUE_ITEM_IMMUTABLE");
  });
});
