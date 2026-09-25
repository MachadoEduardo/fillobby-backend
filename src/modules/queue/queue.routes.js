import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import * as controller from "./queue.controller.js";
import {
  createQueueItemSchema,
  listQueueSchema,
  queueItemParamSchema,
  readinessSchema,
  selfEnrollmentSchema,
  adjustParticipantsSchema,
  selectParticipantsSchema,
  transitionQueueSchema,
} from "./queue.validation.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.post("/", validate(createQueueItemSchema), controller.create);
router.get("/", validate(listQueueSchema), controller.list);
router.get("/:itemId", validate(queueItemParamSchema), controller.detail);
router.patch("/:itemId/status", validate(transitionQueueSchema), controller.transition);
router.put(
  "/:itemId/participants",
  validate(selectParticipantsSchema),
  controller.selectParticipants,
);
router.patch(
  "/:itemId/participants",
  validate(adjustParticipantsSchema),
  controller.adjustParticipants,
);
router.post("/:itemId/participants/me", validate(readinessSchema), controller.joinParticipants);
router.delete("/:itemId/participants/me", validate(readinessSchema), controller.leaveParticipants);
router.patch(
  "/:itemId/self-enrollment",
  validate(selfEnrollmentSchema),
  controller.setSelfEnrollment,
);
router.post("/:itemId/ready", validate(readinessSchema), controller.markReady);
router.delete("/:itemId/ready", validate(readinessSchema), controller.unmarkReady);
router.delete("/:itemId", validate(queueItemParamSchema), controller.remove);

export default router;
