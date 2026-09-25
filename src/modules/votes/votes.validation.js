import { z } from "zod";

const objectId = (label) =>
  z.string({ error: `${label} e obrigatorio.` }).regex(/^[a-f\d]{24}$/i, `${label} invalido.`);

const params = z.object({
  groupId: objectId("Identificador do grupo"),
  itemId: objectId("Identificador do item"),
});

const emptyBody = z.object({}).strict().default({});
const emptyQuery = z.object({}).strict().default({});

export const voteMutationSchema = z.object({
  body: emptyBody,
  params,
  query: emptyQuery,
});

export const listVotesSchema = z.object({
  body: emptyBody,
  params,
  query: z
    .object({
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
    })
    .strict()
    .default({}),
});
