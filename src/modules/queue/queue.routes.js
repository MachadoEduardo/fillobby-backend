import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as controller from './queue.controller.js';
import { createQueueItemSchema, listQueueSchema, queueItemParamSchema, transitionQueueSchema } from './queue.validation.js';

const router = Router({ mergeParams: true });
router.use(authMiddleware);
router.post('/', validate(createQueueItemSchema), controller.create);
router.get('/', validate(listQueueSchema), controller.list);
router.get('/:itemId', validate(queueItemParamSchema), controller.detail);
router.patch('/:itemId/status', validate(transitionQueueSchema), controller.transition);
router.delete('/:itemId', validate(queueItemParamSchema), controller.remove);

export default router;
