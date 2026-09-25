import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../app.js";
import env from "../src/config/env.js";
import Game from "../src/models/Game.js";
import Group from "../src/models/Group.js";
import GroupMember from "../src/models/GroupMember.js";
import QueueItem from "../src/models/QueueItem.js";
import User from "../src/models/User.js";
import Vote from "../src/models/Vote.js";
import VotingRound from "../src/models/VotingRound.js";

const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;

integration("voting rounds", () => {
  let mongoose;
  let sequence = 0;
  beforeAll(async () => {
    mongoose = await import("mongoose");
    await mongoose.default.connect(process.env.TEST_MONGO_URI);
  });
  afterEach(async () => {
    await Vote.deleteMany({});
    await VotingRound.deleteMany({});
    await QueueItem.deleteMany({});
    await Game.deleteMany({});
    await GroupMember.deleteMany({});
    await Group.deleteMany({});
    await User.deleteMany({});
  });
  afterAll(async () => mongoose.default.disconnect());

  async function member(name, group, role = "MEMBER") {
    const user = await User.create({
      name,
      email: `round-${++sequence}@example.com`,
      passwordHash: await bcrypt.hash("SenhaForte123", 4),
    });
    const token = jwt.sign({}, env.jwtSecret, {
      subject: user._id.toString(), expiresIn: "1h", algorithm: "HS256",
    });
    if (group) await GroupMember.create({ group: group._id, user: user._id, role, status: "ACTIVE" });
    return { user, token };
  }

  async function setup() {
    const owner = await member("Owner");
    const group = await Group.create({ name: "Round Group", owner: owner.user._id, inviteCode: `ROUND${sequence}` });
    await GroupMember.create({ group: group._id, user: owner.user._id, role: "OWNER", status: "ACTIVE" });
    const voter = await member("Voter", group);
    const outsider = await member("Outsider");
    const items = [];
    for (const title of ["Portal", "Overcooked"]) {
      const game = await Game.create({ title, normalizedTitle: `${title.toLowerCase()}-${++sequence}`, platforms: ["PC"], createdBy: owner.user._id });
      items.push(await QueueItem.create({ group: group._id, game: game._id, suggestedBy: owner.user._id }));
    }
    const path = `/api/v1/groups/${group._id}/voting-rounds`;
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    return { owner, voter, outsider, group, items, path, auth };
  }

  it("requires admin, valid suggestions and only one open round", async () => {
    const { owner, voter, outsider, items, path, auth } = await setup();
    const candidateIds = items.map((item) => item.id);
    expect((await request(app).post(path).set(auth(outsider.token)).send({ candidateIds })).status).toBe(404);
    expect((await request(app).post(path).set(auth(voter.token)).send({ candidateIds })).status).toBe(403);
    const opened = await request(app).post(path).set(auth(owner.token)).send({ candidateIds });
    expect(opened.status).toBe(201);
    expect(opened.body.data.status).toBe("OPEN");
    expect((await request(app).post(path).set(auth(owner.token)).send({ candidateIds })).status).toBe(409);
    expect((await QueueItem.findById(items[0].id)).status).toBe("VOTING");
    expect((await request(app).put(`/api/v1/groups/${opened.body.data.groupId}/queue/${items[0].id}/participants`).set(auth(owner.token)).send({ participantIds: [voter.user.id] })).status).toBe(409);
  }, 15000);

  it("closes with the unique leader and resets losing suggestions for future rounds", async () => {
    const { owner, voter, group, items, path, auth } = await setup();
    const opened = await request(app).post(path).set(auth(owner.token)).send({ candidateIds: items.map((item) => item.id) });
    const roundId = opened.body.data.id;
    await request(app).post(`/api/v1/groups/${group.id}/queue/${items[0].id}/votes`).set(auth(voter.token)).send({});
    const closed = await request(app).post(`${path}/${roundId}/close`).set(auth(owner.token)).send({});
    expect(closed.status).toBe(200);
    expect(closed.body.data).toMatchObject({ status: "CLOSED", winnerItemId: items[0].id, closedBy: { id: owner.user.id } });
    expect(closed.body.data.candidates.map((candidate) => candidate.voteCount)).toEqual([1, 0]);
    expect((await QueueItem.findById(items[0].id)).status).toBe("WAITING_PLAYERS");
    expect((await QueueItem.findById(items[1].id)).status).toBe("SUGGESTED");
    expect((await request(app).post(`/api/v1/groups/${group.id}/queue/${items[0].id}/votes`).set(auth(voter.token)).send({})).status).toBe(409);
    const list = await request(app).get(path).set(auth(voter.token));
    expect(list.body.data.rounds[0].winnerItemId).toBe(items[0].id);
    const next = await request(app).post(path).set(auth(owner.token)).send({ candidateIds: [items[1].id] });
    expect(next.status).toBe(201);
    expect(next.body.data.candidates[0].voteCount).toBe(0);
    expect((await request(app).post(`/api/v1/groups/${group.id}/queue/${items[1].id}/votes`).set(auth(voter.token)).send({})).status).toBe(201);
    const previous = await request(app).get(path).set(auth(voter.token));
    expect(previous.body.data.rounds[1].candidates.map((candidate) => candidate.voteCount)).toEqual([1, 0]);
  });

  it("requires an admin choice among tied leaders and preserves the tally", async () => {
    const { owner, voter, group, items, path, auth } = await setup();
    const opened = await request(app).post(path).set(auth(owner.token)).send({ candidateIds: items.map((item) => item.id) });
    for (const item of items) await request(app).post(`/api/v1/groups/${group.id}/queue/${item.id}/votes`).set(auth(voter.token)).send({});
    const closePath = `${path}/${opened.body.data.id}/close`;
    expect((await request(app).post(closePath).set(auth(owner.token)).send({})).status).toBe(422);
    const closed = await request(app).post(closePath).set(auth(owner.token)).send({ winnerItemId: items[1].id });
    expect(closed.status).toBe(200);
    expect(closed.body.data.winnerItemId).toBe(items[1].id);
    expect(closed.body.data.candidates.map((candidate) => candidate.voteCount)).toEqual([1, 1]);
    expect((await QueueItem.findById(items[0].id)).voteCount).toBe(0);
    expect(await Vote.countDocuments({ queueItem: items[0].id })).toBe(0);
  });

  it("cannot close without votes and can cancel without choosing a winner", async () => {
    const { owner, items, path, auth } = await setup();
    const opened = await request(app).post(path).set(auth(owner.token)).send({ candidateIds: items.map((item) => item.id) });
    const roundPath = `${path}/${opened.body.data.id}`;
    expect((await request(app).post(`${roundPath}/close`).set(auth(owner.token)).send({})).status).toBe(409);
    const canceled = await request(app).post(`${roundPath}/cancel`).set(auth(owner.token)).send({});
    expect(canceled.status).toBe(200);
    expect(canceled.body.data.status).toBe("CANCELLED");
    expect((await QueueItem.findById(items[0].id)).status).toBe("SUGGESTED");
    expect((await request(app).post(`${roundPath}/cancel`).set(auth(owner.token)).send({})).status).toBe(409);
  });
});
