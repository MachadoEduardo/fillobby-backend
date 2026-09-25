import { Router, raw } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import * as controller from "./profile.controller.js";
import {
  changePasswordSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "./profile.validation.js";
import AppError from "../../shared/errors/AppError.js";

const router = Router();
const avatarBodyParser = raw({ type: () => true, limit: 2 * 1024 * 1024 });

function parseAvatar(req, res, next) {
  avatarBodyParser(req, res, (error) => {
    if (error?.type === "entity.too.large")
      return next(new AppError("AVATAR_TOO_LARGE", "A imagem deve ter no maximo 2 MB.", 413));

    return next(error);
  });
}

router.get("/avatars/:userId", controller.avatar);
router.use(authMiddleware);
router.patch("/", validate(updateProfileSchema), controller.update);
router.patch("/password", validate(changePasswordSchema), controller.changePassword);
router.patch("/preferences", validate(updatePreferencesSchema), controller.updatePreferences);
router.put("/avatar", parseAvatar, controller.uploadAvatar);
router.delete("/avatar", controller.removeAvatar);

export default router;
