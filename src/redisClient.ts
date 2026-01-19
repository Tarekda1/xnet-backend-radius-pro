import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');

const redisClient = redisUrl
  ? createClient({ url: redisUrl })
  : createClient({
      socket: {
        host: redisHost,
        port: redisPort,
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
