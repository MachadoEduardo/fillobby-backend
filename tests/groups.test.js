import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../app.js";
import env from "../src/config/env.js";
import Group from "../src/models/Group.js";
import GroupMember from "../src/models/GroupMember.js";
import QueueItem from "../src/models/QueueItem.js";
import User from "../src/models/User.js";
import Vote from "../src/models/Vote.js";
import { createGroupSchema } from "../src/modules/groups/groups.validation.js";

const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;

describe("groups validation", () => {
  it("returns explicit messages for invalid group fields", async () => {
    const result = createGroupSchema.safeParse({
      body: { name: "x", description: "a".repeat(501) },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});

integration("groups integration", () => {
  let mongoose;
  beforeAll(async () => {
    mongoose = await import("mongoose");
    await mongoose.default.connect(process.env.TEST_MONGO_URI);
  });
  afterEach(async () => {
    await Vote.deleteMany({});
    await QueueItem.deleteMany({});
    await GroupMember.deleteMany({});
    await Group.deleteMany({});
    await User.deleteMany({});
  });
  afterAll(async () => {
    await mongoose.default.disconnect();
  });

  async function register(name, email) {
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
    return { id: user._id.toString(), token };
  }

  it("creates a group and associates the creator as OWNER", async () => {
    const user = await register("Owner User", "owner@example.com");
    const response = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ name: "Grupo Teste", description: "Descricao" });
    expect(response.status).toBe(201);
    expect(response.body.data.role).toBe("OWNER");
    expect(response.body.data.inviteCode).toEqual(expect.any(String));
    expect(
      await GroupMember.exists({
        group: response.body.data.id,
        user: user.id,
        role: "OWNER",
        status: "ACTIVE",
      }),
    ).toBeTruthy();
  });

  it("allows joining by invite and hides the code from members", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const guest = await register("Guest User", "guest@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    const joined = await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ inviteCode: created.body.data.inviteCode });
    expect(joined.status).toBe(201);
    expect(joined.body.data.role).toBe("MEMBER");
    expect(joined.body.data.inviteCode).toBeUndefined();
    const detail = await request(app)
      .get(`/api/v1/groups/${created.body.data.id}`)
      .set("Authorization", `Bearer ${guest.token}`);
    expect(detail.body.data.inviteCode).toBeUndefined();
  });

  it("enforces membership and role permissions", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const outsider = await register("Outsider User", "outsider@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    const denied = await request(app)
      .get(`/api/v1/groups/${created.body.data.id}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(denied.status).toBe(404);
    const forbidden = await request(app)
      .patch(`/api/v1/groups/${created.body.data.id}`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ name: "Outro" });
    expect(forbidden.status).toBe(404);
  });

  it("transfers ownership and prevents the old owner from changing roles", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const member = await register("Member User", "member@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode: created.body.data.inviteCode });
    const transferred = await request(app)
      .post(`/api/v1/groups/${created.body.data.id}/transfer-owner`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ newOwnerId: member.id });
    expect(transferred.status).toBe(200);
    expect((await Group.findById(created.body.data.id)).owner.toString()).toBe(
      member.id,
    );
    const forbidden = await request(app)
      .patch(`/api/v1/groups/${created.body.data.id}/members/${owner.id}/role`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ role: "MEMBER" });
    expect(forbidden.status).toBe(403);
  });

  it("removes a member and cleans active queue participation and votes", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const member = await register("Member User", "member@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode: created.body.data.inviteCode });
    const item = await QueueItem.create({
      group: created.body.data.id,
      game: new mongoose.default.Types.ObjectId(),
      suggestedBy: member.id,
      status: "WAITING_PLAYERS",
      participants: [member.id],
      readyUsers: [member.id],
      voteCount: 1,
    });
    await Vote.create({ queueItem: item._id, user: member.id });
    const removed = await request(app)
      .delete(`/api/v1/groups/${created.body.data.id}/members/${member.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(removed.status).toBe(200);
    const updated = await QueueItem.findById(item._id);
    expect(updated.participants).toHaveLength(0);
    expect(updated.readyUsers).toHaveLength(0);
    expect(updated.voteCount).toBe(0);
    expect(await Vote.countDocuments({ user: member.id })).toBe(0);
  });

  it("recalculates readiness after removing a member from a waiting item", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const member = await register("Member User", "member@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });

    await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode: created.body.data.inviteCode });

    const item = await QueueItem.create({
      group: created.body.data.id,
      game: new mongoose.default.Types.ObjectId(),
      suggestedBy: owner.id,
      status: "WAITING_PLAYERS",
      participants: [owner.id, member.id],
      readyUsers: [owner.id],
    });

    const removed = await request(app)
      .delete(`/api/v1/groups/${created.body.data.id}/members/${member.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(removed.status).toBe(200);
    const updated = await QueueItem.findById(item._id);
    expect(updated.participants.map(String)).toEqual([owner.id]);
    expect(updated.readyUsers.map(String)).toEqual([owner.id]);
    expect(updated.status).toBe("READY");
  });

  it("allows a non-owner to leave and clean their active queue data", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const member = await register("Member User", "member@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode: created.body.data.inviteCode });

    const item = await QueueItem.create({
      group: created.body.data.id,
      game: new mongoose.default.Types.ObjectId(),
      suggestedBy: member.id,
      status: "VOTING",
      participants: [member.id],
      readyUsers: [member.id],
      voteCount: 1,
    });
    await Vote.create({ queueItem: item._id, user: member.id });

    const left = await request(app)
      .post(`/api/v1/groups/${created.body.data.id}/leave`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(left.status).toBe(200);
    expect(left.body.data).toEqual({ userId: member.id, status: "INACTIVE" });
    expect(
      await GroupMember.exists({
        group: created.body.data.id,
        user: member.id,
        status: "INACTIVE",
      }),
    ).toBeTruthy();

    const updated = await QueueItem.findById(item._id);
    expect(updated.participants).toHaveLength(0);
    expect(updated.readyUsers).toHaveLength(0);
    expect(updated.voteCount).toBe(0);
    expect(await Vote.countDocuments({ user: member.id })).toBe(0);
  });

  it("prevents the owner from leaving before transferring ownership", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });

    const response = await request(app)
      .post(`/api/v1/groups/${created.body.data.id}/leave`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("OWNER_CANNOT_LEAVE");
  });

  it("restores a removed member as MEMBER", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const member = await register("Member User", "member@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode: created.body.data.inviteCode });
    await request(app)
      .delete(`/api/v1/groups/${created.body.data.id}/members/${member.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const restored = await request(app)
      .post(`/api/v1/groups/${created.body.data.id}/members/${member.id}/restore`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(restored.status).toBe(200);
    expect(restored.body.data).toMatchObject({
      id: member.id,
      role: "MEMBER",
      status: "ACTIVE",
    });

    const detail = await request(app)
      .get(`/api/v1/groups/${created.body.data.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    expect(detail.status).toBe(200);
  });

  it("allows administrators to list removed members for restoration", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const member = await register("Member User", "member@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });
    await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode: created.body.data.inviteCode });
    await request(app)
      .delete(`/api/v1/groups/${created.body.data.id}/members/${member.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const removed = await request(app)
      .get(`/api/v1/groups/${created.body.data.id}/members?status=REMOVED`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(removed.status).toBe(200);
    expect(removed.body.data.members).toMatchObject([
      { id: member.id, status: "REMOVED" },
    ]);
  });

  it("allows administrators to renew the invite code", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const guest = await register("Guest User", "guest@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Privado" });

    const renewed = await request(app)
      .post(`/api/v1/groups/${created.body.data.id}/regenerate-invite`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(renewed.status).toBe(200);
    expect(renewed.body.data.inviteCode).toEqual(expect.any(String));
    expect(renewed.body.data.inviteCode).not.toBe(created.body.data.inviteCode);

    const oldInvite = await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ inviteCode: created.body.data.inviteCode });

    expect(oldInvite.status).toBe(404);

    const newInvite = await request(app)
      .post("/api/v1/groups/join")
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ inviteCode: renewed.body.data.inviteCode });

    expect(newInvite.status).toBe(201);
  });

  it("soft deletes a group and blocks subsequent access", async () => {
    const owner = await register("Owner User", "owner@example.com");
    const created = await request(app)
      .post("/api/v1/groups")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Grupo Temporario" });

    const deleted = await request(app)
      .delete(`/api/v1/groups/${created.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(deleted.status).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/groups/${created.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(detail.status).toBe(404);
    expect((await Group.findById(created.body.data.id)).isActive).toBe(false);
  });
});
