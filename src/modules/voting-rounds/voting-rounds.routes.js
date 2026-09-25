import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import * as controller from "./voting-rounds.controller.js";
import { cancelRoundSchema, closeRoundSchema, listRoundsSchema, startRoundSchema } from "./voting-rounds.validation.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.get("/", validate(listRoundsSchema), controller.list);
router.post("/", validate(startRoundSchema), controller.start);
router.post("/:roundId/close", validate(closeRoundSchema), controller.close);
router.post("/:roundId/cancel", validate(cancelRoundSchema), controller.cancel);
export default router;
