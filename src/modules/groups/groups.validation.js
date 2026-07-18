import { z } from "zod";

const objectId = z
  .string({ error: "Identificador deve ser um texto valido." })
  .regex(/^[a-f\d]{24}$/i, "Identificador invalido.");

const groupName = z
  .string({ error: "Nome do grupo e obrigatorio." })
  .trim()
  .min(3, "Nome do grupo deve ter no minimo 3 caracteres.")
  .max(80, "Nome do grupo deve ter no maximo 80 caracteres.");

const description = z
  .string({ error: "Descricao deve ser um texto." })
  .trim()
  .max(500, "Descricao deve ter no maximo 500 caracteres.")
  .nullable()
  .optional();

const paramsWithGroup = z.object({ groupId: objectId });
const emptyQuery = z.object({}).default({});

const pagination = z
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
  .default({});

export const createGroupSchema = z.object({
  body: z.object({ name: groupName, description }).strict(),
  params: z.object({}),
  query: emptyQuery,
});

export const listGroupsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}),
  query: pagination,
});

export const groupParamSchema = z.object({
  body: z.object({}).default({}),
  params: paramsWithGroup,
  query: emptyQuery,
});

export const updateGroupSchema = z.object({
  body: z
    .object({ name: groupName.optional(), description })
    .strict()
    .refine(
      (value) => Object.keys(value).length > 0,
      "Informe ao menos um campo para atualizar.",
    ),
  params: paramsWithGroup,
  query: emptyQuery,
});

export const joinGroupSchema = z.object({
  body: z
    .object({
      inviteCode: z
        .string({ error: "Codigo de convite e obrigatorio." })
        .trim()
        .min(1, "Codigo de convite e obrigatorio.")
        .max(32, "Codigo de convite deve ter no maximo 32 caracteres."),
    })
    .strict(),
  params: z.object({}),
  query: emptyQuery,
});

export const memberParamSchema = z.object({
  body: z.object({}).default({}),
  params: paramsWithGroup.extend({ userId: objectId }),
  query: emptyQuery,
});

export const listMembersSchema = z.object({
  body: z.object({}).default({}),
  params: paramsWithGroup,
  query: pagination,
});

export const roleSchema = z.object({
  body: z
    .object({
      role: z.enum(["ADMIN", "MEMBER"], {
        error: "Papel deve ser ADMIN ou MEMBER.",
      }),
    })
    .strict(),
  params: memberParamSchema.shape.params,
  query: emptyQuery,
});

export const transferSchema = z.object({
  body: z.object({ newOwnerId: objectId }).strict(),
  params: paramsWithGroup,
  query: emptyQuery,
});
