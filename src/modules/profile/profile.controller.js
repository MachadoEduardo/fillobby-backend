import * as profileService from "./profile.service.js";

export async function update(req, res, next) {
  try {
    const data = await profileService.updateProfile({
      user: req.user,
      name: req.body.name,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const data = await profileService.changePassword({
      user: req.user,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const data = await profileService.updatePreferences({
      user: req.user,
      preferredPlatforms: req.body.preferredPlatforms,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function uploadAvatar(req, res, next) {
  try {
    const data = await profileService.uploadAvatar({
      user: req.user,
      data: req.body,
      contentType: req.get("content-type")?.split(";")[0],
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function avatar(req, res, next) {
  try {
    const data = await profileService.getAvatar(req.params.userId);
    const etag = `"${data.updatedAt.getTime()}"`;

    res.set({
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(data.size),
      "Content-Type": data.contentType,
      "Cross-Origin-Resource-Policy": "cross-origin",
      ETag: etag,
    });

    if (req.get("if-none-match") === etag) return res.status(304).end();
    return res.status(200).send(data.data);
  } catch (error) {
    return next(error);
  }
}

export async function removeAvatar(req, res, next) {
  try {
    const data = await profileService.removeAvatar(req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
