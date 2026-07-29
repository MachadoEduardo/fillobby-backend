import mongoose from "mongoose";
import UserAvatar from "../../models/UserAvatar.js";
import { serializeUser } from "../auth/auth.service.js";
import AppError from "../../shared/errors/AppError.js";

function detectContentType(data) {
  if (
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";

  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  )
    return "image/jpeg";

  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";

  return null;
}

export async function updateProfile({ user, name }) {
  user.name = name;
  await user.save();
  return serializeUser(user);
}

export async function uploadAvatar({ user, data, contentType }) {
  if (!Buffer.isBuffer(data) || data.length === 0)
    throw new AppError(
      "AVATAR_REQUIRED",
      "Selecione uma imagem para enviar.",
      422,
    );

  const detectedContentType = detectContentType(data);
  if (!detectedContentType || detectedContentType !== contentType)
    throw new AppError(
      "UNSUPPORTED_IMAGE_TYPE",
      "Envie uma imagem JPEG, PNG ou WebP valida.",
      415,
    );

  await UserAvatar.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        data,
        contentType: detectedContentType,
        size: data.length,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  user.avatarUrl = `/api/v1/profile/avatars/${user._id}?v=${Date.now()}`;
  await user.save();
  return serializeUser(user);
}

export async function getAvatar(userId) {
  if (!mongoose.isValidObjectId(userId))
    throw new AppError("AVATAR_NOT_FOUND", "Avatar nao encontrado.", 404);

  const avatar = await UserAvatar.findOne({ user: userId });
  if (!avatar)
    throw new AppError("AVATAR_NOT_FOUND", "Avatar nao encontrado.", 404);

  return avatar;
}

export async function removeAvatar(user) {
  await UserAvatar.deleteOne({ user: user._id });
  user.avatarUrl = null;
  await user.save();
  return serializeUser(user);
}
