import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import * as controller from './games.controller.js';
import { createGameSchema, gameParamSchema, listGamesSchema, updateGameSchema } from './games.validation.js';

const router = Router();

router.use(authMiddleware);
router.post('/', validate(createGameSchema), controller.create);
router.get('/', validate(listGamesSchema), controller.list);
router.get('/:gameId', validate(gameParamSchema), controller.detail);
router.patch('/:gameId', validate(updateGameSchema), controller.update);
router.delete('/:gameId', validate(gameParamSchema), controller.remove);

export default router;
