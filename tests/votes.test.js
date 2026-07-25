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

integration("votes integration", () => {
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

  async function createUser(name) {
    sequence += 1;
    const user = await User.create({
      name,
      email: `vote-${sequence}@example.com`,
      passwordHash: await bcrypt.hash("SenhaForte123", 4),
    });
    const token = jwt.sign({}, env.jwtSecret, {
      subject: user._id.toString(),
      expiresIn: "1h",
      algorithm: "HS256",
    });
    return { user, token };
  }

  async function createContext(status = "VOTING") {
    const owner = await createUser("Vote Owner");
    const member = await createUser("Vote Member");
    sequence += 1;
    const group = await Group.create({
      name: "Vote Group",
      owner: owner.user._id,
      inviteCode: `VOTE${sequence}`,
    });
    await GroupMember.create([
      {
        group: group._id,
        user: owner.user._id,
        role: "OWNER",
        status: "ACTIVE",
      },
      {
        group: group._id,
        user: member.user._id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    ]);
    const game = await Game.create({
      title: `Vote Game ${sequence}`,
      normalizedTitle: `vote game ${sequence}`,
      platforms: ["PC"],
      createdBy: owner.user._id,
    });
    const item = await QueueItem.create({
      group: group._id,
      game: game._id,
      suggestedBy: owner.user._id,
      status,
    });
    return { owner, member, group, game, item };
  }

  function votesPath(groupId, itemId) {
    return `/api/v1/groups/${groupId}/queue/${itemId}/votes`;
  }

  it("creates the authenticated member vote and increments voteCount", async () => {
    const { member, group, item } = await createContext();
    const response = await request(app)
      .post(votesPath(group._id, item._id))
      .set("Authorization", `Bearer ${member.token}`)
      .send({});
    expect(response.status).toBe(201);
    expect(response.body.data.vote.user).toMatchObject({
      id: member.user._id.toString(),
      name: "Vote Member",
    });
    expect(response.body.data.vote.user.email).toBeUndefined();
    expect(response.body.data.voteCount).toBe(1);
    expect((await QueueItem.findById(item._id)).voteCount).toBe(1);
  });

  it("requires authentication and rejects client-controlled identity", async () => {
    const { member, group, item } = await createContext();
    const unauthenticated = await request(app)
      .post(votesPath(group._id, item._id))
      .send({});
    expect(unauthenticated.status).toBe(401);

    const controlled = await request(app)
      .post(votesPath(group._id, item._id))
      .set("Authorization", `Bearer ${member.token}`)
      .send({ userId: member.user._id });
    expect(controlled.status).toBe(422);
  });

  it("hides votes from non-members, inactive members and mismatched groups", async () => {
    const { owner, member, group, item } = await createContext();
    const outsider = await createUser("Vote Outsider");
    const hidden = await request(app)
      .post(votesPath(group._id, item._id))
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({});
    expect(hidden.status).toBe(404);

    await GroupMember.updateOne(
      { group: group._id, user: member.user._id },
      { $set: { status: "REMOVED" } },
    );
    const inactive = await request(app)
      .get(votesPath(group._id, item._id))
      .set("Authorization", `Bearer ${member.token}`);
    expect(inactive.status).toBe(404);

    const other = await createContext();
    const mismatched = await request(app)
      .get(votesPath(group._id, other.item._id))
      .set("Authorization", `Bearer ${owner.token}`);
    expect(mismatched.status).toBe(404);
  });

  it("rejects duplicate votes without incrementing voteCount twice", async () => {
    const { member, group, item } = await createContext();
    await request(app)
      .post(votesPath(group._id, item._id))
      .set("Authorization", `Bearer ${member.token}`)
      .send({});
    const duplicate = await request(app)
      .post(votesPath(group._id, item._id))
      .set("Authorization", `Bearer ${member.token}`)
      .send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("VOTE_ALREADY_EXISTS");
    expect(
      await Vote.countDocuments({ queueItem: item._id, user: member.user._id }),
    ).toBe(1);
    expect((await QueueItem.findById(item._id)).voteCount).toBe(1);
  });

  it("protects vote uniqueness with a database index", async () => {
    await Vote.init();
    const indexes = await Vote.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { queueItem: 1, user: 1 },
          unique: true,
        }),
      ]),
    );
  });

  it("allows voting changes only while the item is VOTING", async () => {
    const suggested = await createContext("SUGGESTED");
    const createResponse = await request(app)
      .post(votesPath(suggested.group._id, suggested.item._id))
      .set("Authorization", `Bearer ${suggested.member.token}`)
      .send({});
    expect(createResponse.status).toBe(409);
    expect(createResponse.body.error.code).toBe("QUEUE_ITEM_NOT_VOTING");

    const voting = await createContext("VOTING");
    await Vote.create({
      queueItem: voting.item._id,
      user: voting.member.user._id,
    });
    voting.item.voteCount = 1;
    await voting.item.save();
    voting.item.status = "WAITING_PLAYERS";
    await voting.item.save();
    const removeResponse = await request(app)
      .delete(`${votesPath(voting.group._id, voting.item._id)}/me`)
      .set("Authorization", `Bearer ${voting.member.token}`);
    expect(removeResponse.status).toBe(409);
    expect(
      await Vote.exists({
        queueItem: voting.item._id,
        user: voting.member.user._id,
      }),
    ).toBeTruthy();
    expect((await QueueItem.findById(voting.item._id)).voteCount).toBe(1);
  });

  it("removes only the authenticated user vote and decrements voteCount", async () => {
    const { owner, member, group, item } = await createContext();
    await Vote.create([
      { queueItem: item._id, user: owner.user._id },
      { queueItem: item._id, user: member.user._id },
    ]);
    item.voteCount = 2;
    await item.save();
    const response = await request(app)
      .delete(`${votesPath(group._id, item._id)}/me`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      queueItemId: item._id.toString(),
      voteCount: 1,
    });
    expect(
      await Vote.exists({ queueItem: item._id, user: member.user._id }),
    ).toBeFalsy();
    expect(
      await Vote.exists({ queueItem: item._id, user: owner.user._id }),
    ).toBeTruthy();
  });

  it("returns VOTE_NOT_FOUND without changing the counter", async () => {
    const { member, group, item } = await createContext();
    const response = await request(app)
      .delete(`${votesPath(group._id, item._id)}/me`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("VOTE_NOT_FOUND");
    expect((await QueueItem.findById(item._id)).voteCount).toBe(0);
  });

  it("lists votes with pagination and without exposing email", async () => {
    const { owner, member, group, item } = await createContext();
    await Vote.create([
      { queueItem: item._id, user: owner.user._id },
      { queueItem: item._id, user: member.user._id },
    ]);
    item.voteCount = 2;
    await item.save();
    const response = await request(app)
      .get(`${votesPath(group._id, item._id)}?page=1&limit=1`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.votes).toHaveLength(1);
    expect(response.body.data.votes[0].user.email).toBeUndefined();
    expect(response.body.data.meta).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });
});
