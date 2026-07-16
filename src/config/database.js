const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI nao configurada no arquivo .env');
  }

  await mongoose.connect(env.mongoUri);
  console.log('MongoDB conectado');
}

module.exports = connectDatabase;