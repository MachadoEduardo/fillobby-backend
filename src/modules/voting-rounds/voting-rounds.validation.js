import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Identificador invalido.");
const groupParams = z.object({ groupId: objectId });
const roundParams = groupParams.extend({ roundId: objectId });
const empty = z.object({}).strict().default({});

export const listRoundsSchema = z.object({
  body: empty,
  params: groupParams,
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(5),
  }).strict().default({}),
});

export const startRoundSchema = z.object({
  body: z.object({
    candidateIds: z.array(objectId).min(1).max(20).refine((ids) => new Set(ids).size === ids.length, "Nao repita jogos."),
  }).strict(),
  params: groupParams,
  query: empty,
});

export const closeRoundSchema = z.object({
  body: z.object({ winnerItemId: objectId.optional() }).strict().default({}),
  params: roundParams,
  query: empty,
});

export const cancelRoundSchema = z.object({
  body: empty,
  params: roundParams,
  query: empty,
});
