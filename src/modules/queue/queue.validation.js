import { z } from "zod";
import { ACTIVE_QUEUE_STATUSES, QUEUE_STATUS } from "./queue.constants.js";

const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch"];
const SORTS = ["votes_desc", "created_asc", "updated_desc"];
const objectId = (label) =>
  z
    .string({ error: `${label} e obrigatorio.` })
    .regex(/^[a-f\d]{24}$/i, `${label} invalido.`);
    
const groupParams = z.object({ groupId: objectId("Identificador do grupo") });
const itemParams = groupParams.extend({
  itemId: objectId("Identificador do item"),
});

const emptyQuery = z.object({}).strict().default({});

const statusFilter = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean),
  )
  .refine(
    (values) =>
      values.length > 0 &&
      values.every((status) => ACTIVE_QUEUE_STATUSES.includes(status)),
    "Status da fila invalido.",
  )
  .optional();

export const createQueueItemSchema = z.object({
  body: z.object({ gameId: objectId("Identificador do jogo") }).strict(),
  params: groupParams,
  query: emptyQuery,
});

export const listQueueSchema = z.object({
  body: z.object({}).default({}),
  params: groupParams,
  query: z
    .object({
      status: statusFilter,
      search: z
        .string()
        .trim()
        .max(120, "Busca deve ter no maximo 120 caracteres.")
        .optional(),
      platform: z.enum(PLATFORMS, { error: "Plataforma invalida." }).optional(),
      page: z.coerce
        .number({ error: "Pagina deve ser um numero." })
        .int("Pagina deve ser um numero inteiro.")
        .min(1, "Pagina deve ser maior ou igual a 1.")
        .default(1),
      limit: z.coerce
        .number({ error: "Limite deve ser um numero." })
        .int("Limite deve ser um numero inteiro.")
        .min(1, "Limite deve ser maior ou igual a 1.")
        .max(100, "Limite nao pode ser maior que 100.")
        .default(20),
      sort: z
        .enum(SORTS, { error: "Ordenacao invalida." })
        .default("votes_desc"),
    })
    .strict()
    .default({}),
});

export const queueItemParamSchema = z.object({
  body: z.object({}).default({}),
  params: itemParams,
  query: emptyQuery,
});

export const transitionQueueSchema = z.object({
  body: z
    .object({
      status: z.enum(
        [QUEUE_STATUS.VOTING, QUEUE_STATUS.PLAYING, QUEUE_STATUS.COMPLETED],
        { error: "Status solicitado invalido." },
      ),
    })
    .strict(),
  params: itemParams,
  query: emptyQuery,
});

export const selectParticipantsSchema = z.object({
  body: z
    .object({
      participantIds: z
        .array(objectId("Identificador do participante"))
        .min(1, "Informe ao menos um participante.")
        .superRefine((values, context) => {
          if (new Set(values).size !== values.length) {
            context.addIssue({
              code: "custom",
              message: "Informe participantes sem duplicatas.",
            });
          }
        }),
    })
    .strict(),
  params: itemParams,
  query: emptyQuery,
});

export const readinessSchema = z.object({
  body: z.object({}).strict().default({}),
  params: itemParams,
  query: emptyQuery,
});

export const selfEnrollmentSchema = z.object({
  body: z.object({ enabled: z.boolean() }).strict(),
  params: itemParams,
  query: emptyQuery,
});

export const adjustParticipantsSchema = z.object({
  body: z.object({
    addIds: z.array(objectId("Identificador do participante")),
    removeIds: z.array(objectId("Identificador do participante")),
  }).strict().superRefine((value, context) => {
    const ids = [...value.addIds, ...value.removeIds];
    if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length)
      context.addIssue({ code: "custom", message: "Nao repita participantes." });
  }),
  params: itemParams,
  query: emptyQuery,
});
