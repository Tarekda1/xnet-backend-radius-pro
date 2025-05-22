import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis://localhost:6379',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Redis Connection Failed:', err);
  }
}

connectRedis();

export { redisClient };
