import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuotaCycleStartDate1770400000000 implements MigrationInterface {
  name = "AddQuotaCycleStartDate1770400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'raduserprofile'
         AND COLUMN_NAME = 'quota_cycle_start_date'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (!exists) {
      await queryRunner.query(
        `ALTER TABLE raduserprofile
           ADD COLUMN quota_cycle_start_date DATE NULL DEFAULT NULL
           AFTER quota_reset_day`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'raduserprofile'
         AND COLUMN_NAME = 'quota_cycle_start_date'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (exists) {
      await queryRunner.query(`ALTER TABLE raduserprofile DROP COLUMN quota_cycle_start_date`);
    }
  }
}
