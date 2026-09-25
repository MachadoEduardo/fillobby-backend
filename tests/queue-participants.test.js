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

integration("queue participants and readiness integration", () => {
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

  async function createUser(name, group, role = "MEMBER", status = "ACTIVE") {
    sequence += 1;
    const user = await User.create({
      name,
      email: `queue-participant-${sequence}@example.com`,
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
        role,
        status,
      });
    }

    return { user, token };
  }

  async function createContext(status = "VOTING", maxPlayers = 2) {
    const owner = await createUser("Participants Owner");
    sequence += 1;
    const group = await Group.create({
      name: "Participants Group",
      owner: owner.user._id,
      inviteCode: `PLAYERS${sequence}`,
    });
    await GroupMember.create({
      group: group._id,
      user: owner.user._id,
      role: "OWNER",
      status: "ACTIVE",
    });
    const first = await createUser("First Player", group);
    const second = await createUser("Second Player", group);
    const game = await Game.create({
      title: `Players Game ${sequence}`,
      normalizedTitle: `players game ${sequence}`,
      platforms: ["PC"],
      maxPlayers,
      createdBy: owner.user._id,
    });
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: first.user._id,
      status,
    });

    return { owner, first, second, group, game, item };
  }

  function participantsPath(groupId, itemId) {
    return `/api/v1/groups/${groupId}/queue/${itemId}/participants`;
  }

  function readyPath(groupId, itemId) {
    return `/api/v1/groups/${groupId}/queue/${itemId}/ready`;
  }

  it("lets an administrator select active members and closes voting", async () => {
    const { owner, first, second, group, item } = await createContext();
    const response = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id, second.user._id] });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("WAITING_PLAYERS");
    expect(response.body.data.participantIds).toEqual([
      first.user._id.toString(),
      second.user._id.toString(),
    ]);
    expect(response.body.data.participants).toEqual([
      {
        id: first.user._id.toString(),
        name: "First Player",
        avatarUrl: null,
      },
      {
        id: second.user._id.toString(),
        name: "Second Player",
        avatarUrl: null,
      },
    ]);
    expect(response.body.data.readyUserIds).toEqual([]);
  });

  it("rejects member selection without an administrative role", async () => {
    const { first, second, group, item } = await createContext();
    const response = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${first.token}`)
      .send({ participantIds: [first.user._id, second.user._id] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INSUFFICIENT_GROUP_ROLE");
  });

  it("rejects empty, duplicate, inactive and excessive participant lists", async () => {
    const { owner, first, second, group, item } = await createContext();
    const empty = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [] });
    expect(empty.status).toBe(422);

    const duplicate = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id, first.user._id] });
    expect(duplicate.status).toBe(422);

    await GroupMember.updateOne(
      { group: group._id, user: second.user._id },
      { $set: { status: "REMOVED" } },
    );
    const inactive = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id, second.user._id] });
    expect(inactive.status).toBe(422);
    expect(inactive.body.error.code).toBe("INVALID_QUEUE_PARTICIPANTS");

    await GroupMember.updateOne(
      { group: group._id, user: second.user._id },
      { $set: { status: "ACTIVE" } },
    );
    const excessive = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        participantIds: [owner.user._id, first.user._id, second.user._id],
      });
    expect(excessive.status).toBe(422);
    expect(excessive.body.error.code).toBe("MAX_PLAYERS_EXCEEDED");
    expect((await QueueItem.findById(item._id)).participants).toHaveLength(0);
  });

  it("allows participant selection only while voting or waiting", async () => {
    const { owner, first, group, item } = await createContext("READY");
    item.participants = [first.user._id];
    item.readyUsers = [first.user._id];
    await item.save();

    const response = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id] });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("QUEUE_PARTICIPANTS_NOT_EDITABLE");
  });

  it("marks readiness idempotently and promotes only after unanimity", async () => {
    const { owner, first, second, group, item } = await createContext();
    await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id, second.user._id] });

    const firstReady = await request(app)
      .post(readyPath(group._id, item._id))
      .set("Authorization", `Bearer ${first.token}`)
      .send({});
    expect(firstReady.status).toBe(200);
    expect(firstReady.body.data.status).toBe("WAITING_PLAYERS");
    expect(firstReady.body.data.readyUserIds).toEqual([
      first.user._id.toString(),
    ]);

    const repeated = await request(app)
      .post(readyPath(group._id, item._id))
      .set("Authorization", `Bearer ${first.token}`)
      .send({});
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.readyUserIds).toHaveLength(1);

    const allReady = await request(app)
      .post(readyPath(group._id, item._id))
      .set("Authorization", `Bearer ${second.token}`)
      .send({});
    expect(allReady.status).toBe(200);
    expect(allReady.body.data.status).toBe("READY");
  });

  it("rejects readiness from a member who is not a participant", async () => {
    const { owner, first, second, group, item } = await createContext();
    await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id] });

    const response = await request(app)
      .post(readyPath(group._id, item._id))
      .set("Authorization", `Bearer ${second.token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("NOT_QUEUE_PARTICIPANT");
  });

  it("removes readiness idempotently and returns READY to waiting", async () => {
    const { first, group, item } = await createContext("READY");
    item.participants = [first.user._id];
    item.readyUsers = [first.user._id];
    await item.save();

    const response = await request(app)
      .delete(readyPath(group._id, item._id))
      .set("Authorization", `Bearer ${first.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("WAITING_PLAYERS");
    expect(response.body.data.readyUserIds).toEqual([]);

    const repeated = await request(app)
      .delete(readyPath(group._id, item._id))
      .set("Authorization", `Bearer ${first.token}`);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.status).toBe("WAITING_PLAYERS");
    expect(repeated.body.data.readyUserIds).toEqual([]);
  });

  it("keeps readiness as a subset when participants are adjusted", async () => {
    const { owner, first, second, group, item } =
      await createContext("WAITING_PLAYERS");
    item.participants = [first.user._id, second.user._id];
    item.readyUsers = [first.user._id];
    await item.save();

    const response = await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id] });

    expect(response.status).toBe(200);
    expect(response.body.data.participantIds).toEqual([
      first.user._id.toString(),
    ]);
    expect(response.body.data.readyUserIds).toEqual([
      first.user._id.toString(),
    ]);
    expect(response.body.data.status).toBe("READY");
  });

  it("handles concurrent readiness without duplicates or a stale status", async () => {
    const { owner, first, second, group, item } = await createContext();
    await request(app)
      .put(participantsPath(group._id, item._id))
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [first.user._id, second.user._id] });

    const responses = await Promise.all([
      request(app)
        .post(readyPath(group._id, item._id))
        .set("Authorization", `Bearer ${first.token}`)
        .send({}),
      request(app)
        .post(readyPath(group._id, item._id))
        .set("Authorization", `Bearer ${second.token}`)
        .send({}),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);

    const persisted = await QueueItem.findById(item._id);
    expect(persisted.readyUsers).toHaveLength(2);
    expect(new Set(persisted.readyUsers.map(String)).size).toBe(2);
    expect(persisted.status).toBe("READY");
  });

  it("allows only admins to enable self-enrollment after voting", async () => {
    const { owner, first, group, item } = await createContext("WAITING_PLAYERS");
    const path = `/api/v1/groups/${group.id}/queue/${item.id}/self-enrollment`;
    expect((await request(app).patch(path).set("Authorization", `Bearer ${first.token}`).send({ enabled: true })).status).toBe(403);
    const enabled = await request(app).patch(path).set("Authorization", `Bearer ${owner.token}`).send({ enabled: true });
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.selfEnrollmentEnabled).toBe(true);
    expect((await request(app).put(participantsPath(group.id, item.id)).set("Authorization", `Bearer ${owner.token}`).send({ participantIds: [first.user.id] })).status).toBe(409);
  });

  it("lets members join, become ready, and leave before play while respecting capacity", async () => {
    const { owner, first, second, group, item } = await createContext("WAITING_PLAYERS", 1);
    const base = participantsPath(group.id, item.id);
    expect((await request(app).post(`${base}/me`).set("Authorization", `Bearer ${first.token}`).send({})).status).toBe(409);
    await request(app).patch(`/api/v1/groups/${group.id}/queue/${item.id}/self-enrollment`).set("Authorization", `Bearer ${owner.token}`).send({ enabled: true });
    const joined = await request(app).post(`${base}/me`).set("Authorization", `Bearer ${first.token}`).send({});
    expect(joined.status).toBe(200);
    expect(joined.body.data.participantIds).toEqual([first.user.id]);
    expect(joined.body.data.status).toBe("WAITING_PLAYERS");
    expect((await request(app).post(`${base}/me`).set("Authorization", `Bearer ${second.token}`).send({})).status).toBe(409);
    expect((await request(app).post(readyPath(group.id, item.id)).set("Authorization", `Bearer ${first.token}`).send({})).body.data.status).toBe("READY");
    const left = await request(app).delete(`${base}/me`).set("Authorization", `Bearer ${first.token}`);
    expect(left.status).toBe(200);
    expect(left.body.data).toMatchObject({ status: "WAITING_PLAYERS", participantIds: [], readyUserIds: [] });
    expect((await request(app).delete(`${base}/me`).set("Authorization", `Bearer ${first.token}`)).status).toBe(200);
  });

  it("preserves concurrent member changes when an admin applies a roster delta", async () => {
    const { owner, first, second, group, item } = await createContext("WAITING_PLAYERS", 3);
    const base = participantsPath(group.id, item.id);
    await request(app).patch(`/api/v1/groups/${group.id}/queue/${item.id}/self-enrollment`).set("Authorization", `Bearer ${owner.token}`).send({ enabled: true });
    const [joined, edited] = await Promise.all([
      request(app).post(`${base}/me`).set("Authorization", `Bearer ${first.token}`).send({}),
      request(app).patch(base).set("Authorization", `Bearer ${owner.token}`).send({ addIds: [second.user.id], removeIds: [] }),
    ]);
    expect(joined.status).toBe(200);
    expect(edited.status).toBe(200);
    expect(new Set((await QueueItem.findById(item.id)).participants.map(String))).toEqual(new Set([first.user.id, second.user.id]));
    await request(app).post(readyPath(group.id, item.id)).set("Authorization", `Bearer ${first.token}`).send({});
    await request(app).post(readyPath(group.id, item.id)).set("Authorization", `Bearer ${second.token}`).send({});
    const removed = await request(app).patch(base).set("Authorization", `Bearer ${owner.token}`).send({ addIds: [], removeIds: [second.user.id] });
    expect(removed.body.data).toMatchObject({ status: "READY", participantIds: [first.user.id], readyUserIds: [first.user.id] });
    await request(app).patch(`/api/v1/groups/${group.id}/queue/${item.id}/self-enrollment`).set("Authorization", `Bearer ${owner.token}`).send({ enabled: false });
    expect((await request(app).delete(`${base}/me`).set("Authorization", `Bearer ${first.token}`)).status).toBe(200);
  });

  it("does not overbook when two members join the last available place", async () => {
    const { owner, first, second, group, item } = await createContext("WAITING_PLAYERS", 1);
    await request(app).patch(`/api/v1/groups/${group.id}/queue/${item.id}/self-enrollment`).set("Authorization", `Bearer ${owner.token}`).send({ enabled: true });
    const path = `${participantsPath(group.id, item.id)}/me`;
    const responses = await Promise.all([
      request(app).post(path).set("Authorization", `Bearer ${first.token}`).send({}),
      request(app).post(path).set("Authorization", `Bearer ${second.token}`).send({}),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await QueueItem.findById(item.id)).participants).toHaveLength(1);
  });

  it("returns a ready item to waiting when another member joins and blocks a premature start", async () => {
    const { owner, first, second, group, item } = await createContext("READY", 2);
    item.participants = [first.user._id];
    item.readyUsers = [first.user._id];
    await item.save();
    await request(app).patch(`/api/v1/groups/${group.id}/queue/${item.id}/self-enrollment`).set("Authorization", `Bearer ${owner.token}`).send({ enabled: true });
    const joined = await request(app).post(`${participantsPath(group.id, item.id)}/me`).set("Authorization", `Bearer ${second.token}`).send({});
    expect(joined.body.data).toMatchObject({ status: "WAITING_PLAYERS", readyUserIds: [first.user.id] });
    const startPath = `/api/v1/groups/${group.id}/queue/${item.id}/status`;
    expect((await request(app).patch(startPath).set("Authorization", `Bearer ${owner.token}`).send({ status: "PLAYING" })).status).not.toBe(200);
    await request(app).post(readyPath(group.id, item.id)).set("Authorization", `Bearer ${second.token}`).send({});
    expect((await request(app).patch(startPath).set("Authorization", `Bearer ${owner.token}`).send({ status: "PLAYING" })).status).toBe(200);
    expect((await request(app).delete(`${participantsPath(group.id, item.id)}/me`).set("Authorization", `Bearer ${second.token}`)).status).toBe(409);
  });

  it("rejects invalid or excessive administrative additions without changing the roster", async () => {
    const { owner, first, second, group, item } = await createContext("WAITING_PLAYERS", 1);
    const path = participantsPath(group.id, item.id);
    await request(app).patch(path).set("Authorization", `Bearer ${owner.token}`).send({ addIds: [first.user.id], removeIds: [] });
    const full = await request(app).patch(path).set("Authorization", `Bearer ${owner.token}`).send({ addIds: [second.user.id], removeIds: [] });
    expect(full.status).toBe(422);
    expect(full.body.error.code).toBe("MAX_PLAYERS_EXCEEDED");
    await GroupMember.updateOne({ group: group.id, user: second.user.id }, { $set: { status: "REMOVED" } });
    const removed = await request(app).patch(path).set("Authorization", `Bearer ${owner.token}`).send({ addIds: [second.user.id], removeIds: [] });
    expect(removed.status).toBe(422);
    expect(removed.body.error.code).toBe("INVALID_QUEUE_PARTICIPANTS");
    expect((await QueueItem.findById(item.id)).participants.map(String)).toEqual([first.user.id]);
  });
});
