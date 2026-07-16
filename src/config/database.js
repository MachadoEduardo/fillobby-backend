import mongoose from 'mongoose';
import env from './env.js';

async function connectDatabase() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI nao configurada no arquivo .env');
  }

  await mongoose.connect(env.mongoUri);
  console.log('MongoDB conectado');
}

export default connectDatabase;
