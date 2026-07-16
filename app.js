import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import connectDatabase from './src/config/database.js';
import env from './src/config/env.js';
import authRoutes from './src/routes/auth.routes.js';

const app = express();

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ message: 'API Fillobby em funcionamento!' });
});

app.use('/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota nao encontrada' });
});

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  connectDatabase()
    .then(() => {
      app.listen(env.port, () => {
        console.log(`Servidor rodando na porta ${env.port}`);
      });
    })
    .catch((error) => {
      console.error('Erro ao conectar no banco de dados:', error.message);
      process.exit(1);
    });
}

export default app;
