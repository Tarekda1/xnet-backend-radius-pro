import { MigrationInterface, QueryRunner } from "typeorm";
import { PERMISSIONS } from "../../access/permissions";

export class AddCableVisionModule1769900000000 implements MigrationInterface {
  name = "AddCableVisionModule1769900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cable_vision_accounts (
        id INT NOT NULL AUTO_INCREMENT,
        accountNumber VARCHAR(64) NOT NULL,
        fullName VARCHAR(128) NOT NULL,
        phoneNumber VARCHAR(32) NULL,
        email VARCHAR(128) NULL,
        address TEXT NULL,
        notes TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        deletedBy VARCHAR(64) NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_cv_accounts_accountNumber_unique (accountNumber),
        KEY IDX_cv_accounts_status (status)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cable_vision_profiles (
        id INT NOT NULL AUTO_INCREMENT,
        accountId INT NOT NULL,
        profileIndex TINYINT NOT NULL,
        profileName VARCHAR(64) NOT NULL,
        assignedTo VARCHAR(128) NULL,
        deviceId VARCHAR(128) NULL,
        monthlyFee FLOAT(12) NOT NULL DEFAULT 0,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        deletedBy VARCHAR(64) NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_cv_profiles_account_profileIndex_unique (accountId, profileIndex),
        KEY IDX_cv_profiles_accountId (accountId),
        CONSTRAINT FK_cv_profiles_account FOREIGN KEY (accountId) REFERENCES cable_vision_accounts (id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cable_vision_invoices (
        id INT NOT NULL AUTO_INCREMENT,
        accountId INT NOT NULL,
        profileId INT NULL,
        amount FLOAT(12) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'unpaid',
        billingMonth DATE NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paidAt TIMESTAMP NULL,
        paymentMethod VARCHAR(20) NULL,
        collectedBy VARCHAR(64) NULL,
        collectedAt TIMESTAMP NULL,
        cashReconciled TINYINT(1) NOT NULL DEFAULT 0,
        reconciledBy VARCHAR(64) NULL,
        reconciledAt TIMESTAMP NULL,
        modifiedBy VARCHAR(64) NULL,
        deletedBy VARCHAR(64) NULL,
        lastAction VARCHAR(255) NULL,
        modifiedAt DATETIME NULL,
        deletedAt DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_cv_invoices_profile_billing_unique (profileId, billingMonth),
        KEY IDX_cv_invoices_accountId (accountId),
        KEY IDX_cv_invoices_profileId (profileId),
        KEY IDX_cv_invoices_billingMonth (billingMonth),
        CONSTRAINT FK_cv_invoices_account FOREIGN KEY (accountId) REFERENCES cable_vision_accounts (id) ON DELETE RESTRICT,
        CONSTRAINT FK_cv_invoices_profile FOREIGN KEY (profileId) REFERENCES cable_vision_profiles (id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    const requiredPerms = [
      "ui.sidebar.cablevision.show",
      "cablevision.accounts.view",
      "cablevision.accounts.manage",
      "cablevision.invoices.view",
      "cablevision.invoices.pay",
      "cablevision.invoices.unpay",
      "cablevision.invoices.generate",
    ] as const;

    for (const p of requiredPerms) {
      if (!PERMISSIONS.includes(p as any)) {
        throw new Error(`Permission not registered in PERMISSIONS: ${p}`);
      }
    }

    const roleRows = (await queryRunner.query(`SELECT id, \`key\` as roleKey FROM roles`)) as Array<{
      id: number;
      roleKey: string;
    }>;
    const roleIdByKey = new Map<string, number>();
    for (const r of roleRows) roleIdByKey.set(String(r.roleKey), Number(r.id));

    const insertPerms = async (roleKey: string, perms: string[]) => {
      const roleId = roleIdByKey.get(roleKey);
      if (!roleId) return;
      for (const p of perms) {
        await queryRunner.query(`INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)`, [roleId, p]);
      }
    };

    // Let everyone see the Cable Vision menu item by default; access is still enforced by API permissions.
    for (const r of roleRows) {
      const roleId = Number((r as any).id);
      if (!Number.isFinite(roleId)) continue;
      await queryRunner.query(`INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)`, [
        roleId,
        "ui.sidebar.cablevision.show",
      ]);
    }

    await insertPerms("admin", [
      "cablevision.accounts.view",
      "cablevision.accounts.manage",
      "cablevision.invoices.view",
      "cablevision.invoices.pay",
      "cablevision.invoices.unpay",
      "cablevision.invoices.generate",
    ]);

    await insertPerms("manager", [
      "cablevision.accounts.view",
      "cablevision.accounts.manage",
      "cablevision.invoices.view",
      "cablevision.invoices.pay",
      "cablevision.invoices.unpay",
      "cablevision.invoices.generate",
    ]);

    await insertPerms("support", ["cablevision.accounts.view", "cablevision.invoices.view"]);

    await insertPerms("collector", ["cablevision.accounts.view", "cablevision.invoices.view", "cablevision.invoices.pay"]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      WHERE rp.permission IN (
        'ui.sidebar.cablevision.show',
        'cablevision.accounts.view',
        'cablevision.accounts.manage',
        'cablevision.invoices.view',
        'cablevision.invoices.pay',
        'cablevision.invoices.unpay',
        'cablevision.invoices.generate'
      );
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS cable_vision_invoices;`);
    await queryRunner.query(`DROP TABLE IF EXISTS cable_vision_profiles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS cable_vision_accounts;`);
  }
}

