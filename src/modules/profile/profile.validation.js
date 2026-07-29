import { z } from "zod";

const emptyQuery = z.object({}).default({});

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string({ error: "Nome e obrigatorio." })
        .trim()
        .min(2, "Nome deve ter no minimo 2 caracteres.")
        .max(80, "Nome deve ter no maximo 80 caracteres."),
    })
    .strict(),
  params: z.object({}),
  query: emptyQuery,
});
