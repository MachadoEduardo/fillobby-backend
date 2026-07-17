import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me } from './auth.controller.js';
import { registerSchema, loginSchema } from './auth.validation.js';
import { validate } from '../../middlewares/validation.middleware.js';
import authMiddleware from '../../middlewares/auth.middleware.js';

const router = Router();
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authMiddleware, me);

export default router;
