import { z } from "zod";
import { passwordSchema } from "../auth/auth.validation.js";

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

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Senha atual e obrigatoria."),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, "Confirmacao da nova senha e obrigatoria."),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "A confirmacao da senha nao confere.",
        });
      }
    }),
  params: z.object({}),
  query: emptyQuery,
});
