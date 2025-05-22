// QuotaService.ts
import { DataSource, QueryRunner } from 'typeorm';
import { Raduserprofile } from '../db/entities/Raduserprofile';
import { CacheService  } from './cacheService';
import { EventBus } from '../bus/eventBus';

export class QuotaService {
  private dataSource: DataSource;
  private eventBus: EventBus;

  constructor(dataSource: DataSource, eventBus: EventBus, private cacheService: CacheService) {
    this.dataSource = dataSource;
    this.eventBus = eventBus;
    this.cacheService = cacheService;
  }

  async resetDailyQuota(username: string): Promise<void> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Step 1: Reset daily usage in radusagestats
      await queryRunner.query(
        `UPDATE radusagestats 
         SET data_usage = 0
         WHERE day = ? AND username = ?;`,
        [today, username]
      );

      // Step 2: Reset session tracking values for sessions started today
      await queryRunner.query(
        `UPDATE session_tracking 
         SET daily_bytes_in = 0, daily_bytes_out = 0, daily_session_time = 0,
             bytes_in = 0, bytes_out = 0, session_time = 0, last_update = NOW()
         WHERE username = ? AND DATE(start_time) = ? AND (DATE(end_time) = ? OR end_time IS NULL);`,
        [username, today, today]
      );

      // Step 3: Update fallback profile field in raduserprofile
      const userProfileRepository = queryRunner.manager.getRepository(Raduserprofile);
      await userProfileRepository.update({ username }, { isFallback: false });

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Step 4: Invalidate cache
      await this.cacheService.deleteCacheKeys();

      // Instead of directly disconnecting and updating session, publish an event
      await this.eventBus.publish({
        action: 'disconnectAndCompleteSession',
        username,
        ip: '172.8.16.2',
        code: 'tisp123'
      });
    } catch (error) {
      console.error('Error resetting daily quota:', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
