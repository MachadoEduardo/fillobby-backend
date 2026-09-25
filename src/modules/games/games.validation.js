import { z } from "zod";

const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch"];
const objectId = z
  .string({ error: "Identificador do jogo e obrigatorio." })
  .regex(/^[a-f\d]{24}$/i, "Identificador do jogo invalido.");

const title = z
  .string({ error: "Titulo e obrigatorio." })
  .trim()
  .min(1, "Titulo e obrigatorio.")
  .max(120, "Titulo deve ter no maximo 120 caracteres.");

const platforms = z
  .array(z.enum(PLATFORMS, { error: "Plataforma invalida." }), {
    error: "Plataformas sao obrigatorias.",
  })
  .min(1, "Informe pelo menos uma plataforma.")
  .refine(
    (values) => new Set(values).size === values.length,
    "Nao informe plataformas duplicadas.",
  );

const maxPlayers = z
  .number({ error: "Maximo de jogadores deve ser um numero." })
  .int("Maximo de jogadores deve ser um numero inteiro.")
  .min(1, "Maximo de jogadores deve ser maior que zero.")
  .nullable();

const coverUrl = z
  .string({ error: "URL da capa deve ser um texto." })
  .trim()
  .url("URL da capa invalida.")
  .nullable();

const description = z
  .string({ error: "Descricao deve ser um texto." })
  .trim()
  .max(1000, "Descricao deve ter no maximo 1000 caracteres.")
  .nullable();

const emptyParams = z.object({});
const emptyQuery = z.object({}).strict().default({});

export const createGameSchema = z.object({
  body: z
    .object({
      title,
      platforms,
      maxPlayers: maxPlayers.optional(),
      coverUrl: coverUrl.optional(),
      description: description.optional(),
    })
    .strict(),
  params: emptyParams,
  query: emptyQuery,
});

export const listGamesSchema = z.object({
  body: z.object({}).default({}),
  params: emptyParams,
  query: z
    .object({
      search: z.string().trim().max(120, "Busca deve ter no maximo 120 caracteres.").optional(),
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
    })
    .strict()
    .default({}),
});

export const gameParamSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({ gameId: objectId }),
  query: emptyQuery,
});

export const updateGameSchema = z.object({
  body: z
    .object({
      title: title.optional(),
      platforms: platforms.optional(),
      maxPlayers: maxPlayers.optional(),
      coverUrl: coverUrl.optional(),
      description: description.optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar."),
  params: z.object({ gameId: objectId }),
  query: emptyQuery,
});
