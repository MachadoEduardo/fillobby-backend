import { z } from "zod";

const objectId = (label) =>
  z.string({ error: `${label} e obrigatorio.` }).regex(/^[a-f\d]{24}$/i, `${label} invalido.`);

function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const dateOnly = z
  .string({ error: "Data deve ser informada no formato YYYY-MM-DD." })
  .refine(isValidDateOnly, "Data deve ser valida e usar o formato YYYY-MM-DD.");

export const listHistorySchema = z.object({
  body: z.object({}).strict().default({}),
  params: z.object({
    groupId: objectId("Identificador do grupo"),
  }),
  query: z
    .object({
      from: dateOnly.optional(),
      to: dateOnly.optional(),
      gameId: objectId("Identificador do jogo").optional(),
      participantId: objectId("Identificador do participante").optional(),
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
    .superRefine((value, context) => {
      if (value.from && value.to && value.from > value.to) {
        context.addIssue({
          code: "custom",
          path: ["to"],
          message: "Data final deve ser igual ou posterior a data inicial.",
        });
      }
    })
    .default({}),
});
