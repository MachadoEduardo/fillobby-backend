import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Senha deve ser maior ou igual a 8 caracteres")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Senha deve ter no maximo 72 bytes")
  .regex(/[a-z]/, "Senha deve conter letra minuscula")
  .regex(/[A-Z]/, "Senha deve conter letra maiuscula")
  .regex(/\d/, "Senha deve conter numero");

const base = z.object({
  body: z.object({}).strict(),
  params: z.object({}),
  query: z.object({}),
});

export const registerSchema = base.extend({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Nome deve ser maior ou igual a 2 caracteres")
        .max(80, "Nome deve ser menor ou igual a 80 caracteres"),
      email: z.string().trim().toLowerCase().email("Email invalido"),
      password: passwordSchema,
      confirmPassword: z.string().min(1, "Confirmacao da senha e obrigatoria."),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmPassword"],
          message: "A confirmacao da senha nao confere.",
        });
      }
    }),
});

export const loginSchema = base.extend({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(1),
    })
    .strict(),
});

export const emptySchema = base;
