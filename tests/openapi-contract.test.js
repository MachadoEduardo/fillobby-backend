import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import request from "supertest";
import { parse } from "yaml";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../app.js";
import Game from "../src/models/Game.js";
import Group from "../src/models/Group.js";
import GroupMember from "../src/models/GroupMember.js";
import QueueItem from "../src/models/QueueItem.js";
import User from "../src/models/User.js";
import Vote from "../src/models/Vote.js";

const contract = parse(
  readFileSync(fileURLToPath(new URL("../docs/openapi.yaml", import.meta.url)), "utf8"),
);
// OpenAPI annotations such as `example` are not validation keywords.
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

// OpenAPI 3.1 schemas are JSON Schema 2020-12. Register component schemas so
// operation response refs resolve without rewriting or duplicating the contract.
for (const [name, schema] of Object.entries(contract.components.schemas)) {
  ajv.addSchema(schema, `#/components/schemas/${name}`);
}

function assertResponse(method, path, response) {
  const operation = contract.paths[path]?.[method];
  expect(operation, `Missing OpenAPI operation ${method.toUpperCase()} ${path}`).toBeDefined();
  const declared = operation.responses[String(response.status)];
  expect(declared, `Undocumented HTTP ${response.status} for ${method.toUpperCase()} ${path}`).toBeDefined();
  const definition = declared.$ref
    ? contract.components.responses[declared.$ref.split("/").at(-1)]
    : declared;
  const schema = definition.content?.["application/json"]?.schema;
  expect(schema, `Missing JSON schema for HTTP ${response.status} ${path}`).toBeDefined();
  expect(response.headers["content-type"]).toMatch(/application\/json/);
  const validate = ajv.compile(schema);
  expect(validate(response.body), JSON.stringify(validate.errors)).toBe(true);
}

describe("OpenAPI response contract", () => {
  it("describes validation and authorization errors without a database", async () => {
    const invalid = await request(app).post("/api/v1/auth/register").send({ email: "invalid" });
    expect(invalid.status).toBe(422);
    assertResponse("post", "/api/v1/auth/register", invalid);
    const unauthorized = await request(app).get("/api/v1/auth/me");
    expect(unauthorized.status).toBe(401);
    assertResponse("get", "/api/v1/auth/me", unauthorized);
  });
});

const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;
integration("OpenAPI central flow contract", () => {
  let mongoose;
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
  afterAll(async () => mongoose.default.disconnect());

  it("matches registration, login, groups, queue, voting and history", async () => {
    const registration = await request(app).post("/api/v1/auth/register").send({
      name: "Contract User",
      email: "contract@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(registration.status).toBe(201);
    assertResponse("post", "/api/v1/auth/register", registration);
    const login = await request(app).post("/api/v1/auth/login").send({
      email: "contract@example.com",
      password: "Password123",
    });
    expect(login.status).toBe(200);
    assertResponse("post", "/api/v1/auth/login", login);
    const authorization = `Bearer ${login.body.data.token}`;
    const me = await request(app).get("/api/v1/auth/me").set("Authorization", authorization);
    assertResponse("get", "/api/v1/auth/me", me);

    const group = await request(app).post("/api/v1/groups")
      .set("Authorization", authorization).send({ name: "Contract Group" });
    expect(group.status).toBe(201);
    assertResponse("post", "/api/v1/groups", group);
    const groupId = group.body.data.id;
    const repeatedJoin = await request(app).post("/api/v1/groups/join")
      .set("Authorization", authorization).send({ inviteCode: group.body.data.inviteCode });
    expect(repeatedJoin.status).toBe(200);
    assertResponse("post", "/api/v1/groups/join", repeatedJoin);
    const groups = await request(app).get("/api/v1/groups").set("Authorization", authorization);
    assertResponse("get", "/api/v1/groups", groups);
    const game = await request(app).post("/api/v1/games")
      .set("Authorization", authorization).send({ title: "Portal 2", platforms: ["PC"] });
    expect(game.status).toBe(201);
    assertResponse("post", "/api/v1/games", game);
    const gameId = game.body.data.game.id;
    const queuePath = "/api/v1/groups/{groupId}/queue";
    const queue = await request(app).post(`/api/v1/groups/${groupId}/queue`)
      .set("Authorization", authorization).send({ gameId });
    expect(queue.status).toBe(201);
    assertResponse("post", queuePath, queue);
    const itemId = queue.body.data.id;
    const queueList = await request(app).get(`/api/v1/groups/${groupId}/queue`)
      .set("Authorization", authorization);
    assertResponse("get", queuePath, queueList);
    const statusPath = "/api/v1/groups/{groupId}/queue/{itemId}/status";
    const voting = await request(app).patch(`/api/v1/groups/${groupId}/queue/${itemId}/status`)
      .set("Authorization", authorization).send({ status: "VOTING" });
    expect(voting.status).toBe(200);
    assertResponse("patch", statusPath, voting);
    const votePath = "/api/v1/groups/{groupId}/queue/{itemId}/votes";
    const vote = await request(app).post(`/api/v1/groups/${groupId}/queue/${itemId}/votes`)
      .set("Authorization", authorization);
    expect(vote.status).toBe(201);
    assertResponse("post", votePath, vote);
    const duplicate = await request(app).post(`/api/v1/groups/${groupId}/queue/${itemId}/votes`)
      .set("Authorization", authorization);
    expect(duplicate.status).toBe(409);
    assertResponse("post", votePath, duplicate);
    const history = await request(app).get(`/api/v1/groups/${groupId}/history`)
      .set("Authorization", authorization);
    assertResponse("get", "/api/v1/groups/{groupId}/history", history);
  });
});
