import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalInvoiceLastRemindedAt1770600000000 implements MigrationInterface {
  name = "AddExternalInvoiceLastRemindedAt1770600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'external_invoices'
         AND COLUMN_NAME = 'lastRemindedAt'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (!exists) {
      await queryRunner.query(
        `ALTER TABLE external_invoices
           ADD COLUMN lastRemindedAt TIMESTAMP NULL DEFAULT NULL
           AFTER lastAction`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'external_invoices'
         AND COLUMN_NAME = 'lastRemindedAt'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (exists) {
      await queryRunner.query(`ALTER TABLE external_invoices DROP COLUMN lastRemindedAt`);
    }
  }
}
