import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserFreenightFlag1769910000000 implements MigrationInterface {
  name = "AddUserFreenightFlag1769910000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'raduserprofile'
         AND COLUMN_NAME = 'freenight'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (!exists) {
      await queryRunner.query(
        `ALTER TABLE raduserprofile
           ADD COLUMN freenight TINYINT(1) NULL DEFAULT 0
           AFTER profile_id`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'raduserprofile'
         AND COLUMN_NAME = 'freenight'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (exists) {
      await queryRunner.query(`ALTER TABLE raduserprofile DROP COLUMN freenight`);
    }
  }
}
