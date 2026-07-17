import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';
import AppError from '../shared/errors/AppError.js';

export default async function authMiddleware(req, res, next) {
  try {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) throw new AppError('AUTH_TOKEN_REQUIRED', 'Token de autenticacao obrigatorio.', 401);

    const token = header.slice(7).trim();
    if (!token) throw new AppError('AUTH_TOKEN_REQUIRED', 'Token de autenticacao obrigatorio.', 401);

    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findOne({ _id: payload.sub, isActive: true });
    if (!user) throw new AppError('AUTH_TOKEN_INVALID', 'Token invalido.', 401);

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('AUTH_TOKEN_INVALID', 'Token invalido ou expirado.', 401));
  }
}
