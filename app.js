const express = require('express');
const connectDatabase = require('./src/config/database');
const env = require('./src/config/env');
const cors = require("cors");

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

app.use((req, res) => {
  res.status(404).json({ message: 'Rota nao encontrada' });
});

if (require.main === module) {
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

module.exports = app;