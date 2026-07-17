import { z } from "zod";

const password = z
  .string()
  .min(8)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Senha deve ter no maximo 72 bytes",
  )
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
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      password,
    })
    .strict(),
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
