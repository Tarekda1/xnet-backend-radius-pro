import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResellerModuleTables1736632000000 implements MigrationInterface {
  name = "AddResellerModuleTables1736632000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Resellers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS resellers (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(128) NOT NULL,
        code VARCHAR(64) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_reseller_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2) Extend system_users role enum + add reseller_id
    await queryRunner.query(`
      ALTER TABLE system_users
        MODIFY COLUMN role ENUM('admin','manager','support','collector','reseller') NULL DEFAULT 'support';
    `);

    // reseller_id column (nullable)
    await queryRunner.query(`
      ALTER TABLE system_users
        ADD COLUMN reseller_id INT NULL,
        ADD INDEX idx_system_users_reseller_id (reseller_id);
    `);
    await queryRunner.query(`
      ALTER TABLE system_users
        ADD CONSTRAINT fk_system_users_reseller_id
        FOREIGN KEY (reseller_id) REFERENCES resellers(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // 3) Link radius users to reseller ownership
    await queryRunner.query(`
      ALTER TABLE raduserprofile
        ADD COLUMN owner_reseller_id INT NULL,
        ADD INDEX idx_raduserprofile_owner_reseller_id (owner_reseller_id);
    `);
    await queryRunner.query(`
      ALTER TABLE raduserprofile
        ADD CONSTRAINT fk_raduserprofile_owner_reseller_id
        FOREIGN KEY (owner_reseller_id) REFERENCES resellers(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // 4) Reseller ledger
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reseller_ledger (
        id BIGINT NOT NULL AUTO_INCREMENT,
        reseller_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'USD',
        entry_type ENUM('credit','debit') NOT NULL,
        reference_type VARCHAR(64) NULL,
        reference_id VARCHAR(64) NULL,
        note VARCHAR(255) NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_reseller_ledger_reseller_id (reseller_id),
        CONSTRAINT fk_reseller_ledger_reseller_id
          FOREIGN KEY (reseller_id) REFERENCES resellers(id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_reseller_ledger_created_by
          FOREIGN KEY (created_by) REFERENCES system_users(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop ledger and reseller tables first (to release FKs)
    await queryRunner.query(`DROP TABLE IF EXISTS reseller_ledger;`);

    // Remove raduserprofile owner_reseller_id
    await queryRunner.query(`ALTER TABLE raduserprofile DROP FOREIGN KEY fk_raduserprofile_owner_reseller_id;`);
    await queryRunner.query(`ALTER TABLE raduserprofile DROP INDEX idx_raduserprofile_owner_reseller_id;`);
    await queryRunner.query(`ALTER TABLE raduserprofile DROP COLUMN owner_reseller_id;`);

    // Remove system_users reseller_id
    await queryRunner.query(`ALTER TABLE system_users DROP FOREIGN KEY fk_system_users_reseller_id;`);
    await queryRunner.query(`ALTER TABLE system_users DROP INDEX idx_system_users_reseller_id;`);
    await queryRunner.query(`ALTER TABLE system_users DROP COLUMN reseller_id;`);

    // Revert role enum (drop reseller)
    await queryRunner.query(`
      ALTER TABLE system_users
        MODIFY COLUMN role ENUM('admin','manager','support','collector') NULL DEFAULT 'support';
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS resellers;`);
  }
}

