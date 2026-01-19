import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFirstLoginPasswordChange1736634000000 implements MigrationInterface {
  name = "AddFirstLoginPasswordChange1736634000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE system_users
        ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN password_changed_at TIMESTAMP NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE system_users
        DROP COLUMN password_changed_at,
        DROP COLUMN must_change_password;
    `);
  }
}

