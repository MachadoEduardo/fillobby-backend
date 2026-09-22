import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && isProduction) {
  throw new Error('JWT_SECRET deve ser configurado em producao');
}

const env = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: jwtSecret || 'development-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  authRegisterRateLimit: Number(process.env.AUTH_REGISTER_RATE_LIMIT || 5),
  authLoginRateLimit: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || '',
};

export default env;
