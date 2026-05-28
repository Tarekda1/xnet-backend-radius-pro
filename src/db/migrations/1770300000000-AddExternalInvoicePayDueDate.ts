import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalInvoicePayDueDate1770300000000 implements MigrationInterface {
  name = "AddExternalInvoicePayDueDate1770300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'external_invoices'
         AND COLUMN_NAME = 'payDueDate'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (!exists) {
      await queryRunner.query(
        `ALTER TABLE external_invoices
           ADD COLUMN payDueDate DATE NULL
           AFTER billingMonth`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'external_invoices'
         AND COLUMN_NAME = 'payDueDate'`
    )) as Array<{ cnt: string | number }>;
    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (exists) {
      await queryRunner.query(`ALTER TABLE external_invoices DROP COLUMN payDueDate`);
    }
  }
}
