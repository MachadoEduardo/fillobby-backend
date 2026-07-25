import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { list } from "./history.controller.js";
import { listHistorySchema } from "./history.validation.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.get("/", validate(listHistorySchema), list);

export default router;
