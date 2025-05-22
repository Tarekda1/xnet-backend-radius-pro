// CacheService.ts
import { redisClient } from '../redisClient';

export class CacheService {
  async deleteCacheKeys(pattern: string = 'user:*'): Promise<void> {
    try {
      // Ensure the client is connected before using it
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Deleted keys: ${keys.join(', ')}`);
      } else {
        console.log('No cache keys found to delete.');
      }
    } catch (error) {
      console.error('Error deleting cache keys:', error);
    }
  }
  
  async disconnect(): Promise<void> {
    if (redisClient.isOpen) {
      await redisClient.disconnect();
      console.log('Disconnected from Redis');
    }
  }
}

export default new CacheService();
