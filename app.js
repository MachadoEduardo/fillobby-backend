import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import connectDatabase from './src/config/database.js';
import env from './src/config/env.js';
import authRoutes from './src/modules/auth/auth.routes.js';
import groupsRoutes from './src/modules/groups/groups.routes.js';
import gamesRoutes from './src/modules/games/games.routes.js';
import queueRoutes from './src/modules/queue/queue.routes.js';
import votesRoutes from './src/modules/votes/votes.routes.js';
import historyRoutes from './src/modules/history/history.routes.js';
import profileRoutes from './src/modules/profile/profile.routes.js';
import { errorMiddleware, notFoundMiddleware } from './src/middlewares/error.middleware.js';

const app = express();
const localOrigins = ['http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173'];
const allowedOrigins = env.nodeEnv === 'production'
  ? [env.frontendUrl]
  : [...new Set([...localOrigins, env.frontendUrl].filter(Boolean))];

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem nao permitida pelo CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.get('/', (req, res) => res.status(200).json({ success: true, data: { message: 'API Fillobby em funcionamento!' } }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/groups/:groupId/history', historyRoutes);
app.use('/api/v1/groups', groupsRoutes);
app.use('/api/v1/games', gamesRoutes);
app.use('/api/v1/groups/:groupId/queue', queueRoutes);
app.use('/api/v1/groups/:groupId/queue/:itemId/votes', votesRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  connectDatabase()
    .then(() => app.listen(env.port, () => console.log(`Servidor rodando na porta ${env.port}`)))
    .catch((error) => { console.error('Erro ao conectar no banco de dados:', error.message); process.exit(1); });
}

export default app;
