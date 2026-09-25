import { Router } from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import * as controller from "./votes.controller.js";
import { listVotesSchema, voteMutationSchema } from "./votes.validation.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.post("/", validate(voteMutationSchema), controller.create);
router.get("/", validate(listVotesSchema), controller.list);
router.delete("/me", validate(voteMutationSchema), controller.remove);

export default router;
