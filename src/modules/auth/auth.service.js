import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import env from "../../config/env.js";
import AppError from "../../shared/errors/AppError.js";

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    preferredPlatforms: user.preferredPlatforms ?? [],
  };
}

export async function register({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError("EMAIL_ALREADY_EXISTS", "Email ja cadastrado.", 409);

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  try {
    const user = await User.create({ name, email, passwordHash });
    return serializeUser(user);
  } catch (error) {
    if (error?.code === 11000)
      throw new AppError("EMAIL_ALREADY_EXISTS", "Email ja cadastrado.", 409);
    throw error;
  }
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash)))
    throw new AppError("INVALID_CREDENTIALS", "Email ou senha invalidos.", 401);

  const token = jwt.sign({}, env.jwtSecret, {
    subject: user._id.toString(),
    expiresIn: env.jwtExpiresIn,
    algorithm: "HS256",
  });
  return { token, user: serializeUser(user) };
}
