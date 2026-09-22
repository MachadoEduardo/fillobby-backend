import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me } from './auth.controller.js';
import { registerSchema, loginSchema } from './auth.validation.js';
import { validate } from '../../middlewares/validation.middleware.js';
import authMiddleware from '../../middlewares/auth.middleware.js';
import env from '../../config/env.js';

const router = Router();

function createRateLimitHandler(message) {
  return (req, res) => res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      details: [],
    },
  });
}

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.authRegisterRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Limite de cadastros atingido. Tente novamente mais tarde.'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authLoginRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
  ),
});

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authMiddleware, me);

export default router;
