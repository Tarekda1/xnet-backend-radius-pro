import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccessControlTables1736623200000 implements MigrationInterface {
  name = "AddAccessControlTables1736623200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description VARCHAR(255) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_roles_key_unique (\`key\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT NOT NULL AUTO_INCREMENT,
        roleId INT NOT NULL,
        permission VARCHAR(128) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_role_permissions_role_permission_unique (roleId, permission),
        KEY IDX_role_permissions_roleId (roleId),
        CONSTRAINT FK_role_permissions_role FOREIGN KEY (roleId) REFERENCES roles (id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_permission_overrides (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        permission VARCHAR(128) NOT NULL,
        effect ENUM('allow','deny') NOT NULL DEFAULT 'allow',
        PRIMARY KEY (id),
        UNIQUE KEY IDX_user_permission_overrides_user_permission_unique (userId, permission),
        KEY IDX_user_permission_overrides_userId (userId),
        CONSTRAINT FK_user_permission_overrides_user FOREIGN KEY (userId) REFERENCES system_users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Seed roles for existing system users role enum values
    await queryRunner.query(`
      INSERT IGNORE INTO roles (\`key\`, name, description) VALUES
        ('admin', 'Admin', 'Full access'),
        ('manager', 'Manager', 'Manager access'),
        ('support', 'Support', 'Support access'),
        ('collector', 'Collector', 'Collector access');
    `);

    // Default role permissions:
    // - admin: everything (baseline)
    // - manager: most admin views + billing + radius
    // - support: view-only for most screens
    // - collector: billing/reconciliation basics
    //
    // Note: Permissions are strings; registry lives in src/access/permissions.ts
    const roleIds = await queryRunner.query(`SELECT id, \`key\` as roleKey FROM roles`);
    const roleIdByKey = new Map<string, number>();
    for (const r of roleIds) roleIdByKey.set(String(r.roleKey), Number(r.id));

    const insertPerms = async (roleKey: string, perms: string[]) => {
      const roleId = roleIdByKey.get(roleKey);
      if (!roleId) return;
      for (const p of perms) {
        await queryRunner.query(
          `INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)`,
          [roleId, p]
        );
      }
    };

    await insertPerms("admin", [
      "admin.analytics.view",
      "admin.alerts.view",
      "admin.expenses.view",
      "admin.authUsers.manage",
      "admin.access.manage",
      "users.view",
      "users.online.view",
      "radius.settings.view",
      "radius.nas.view",
      "radius.profiles.view",
      "billing.invoiceUpload.create",
      "billing.externalInvoices.view",
      "billing.externalInvoices.viewTotals",
      "billing.externalInvoices.unpay",
      "billing.collections.view",
      "dashboard.widget.totalAmount",
      "dashboard.widget.invoiceCounts"
    ]);

    await insertPerms("manager", [
      "admin.analytics.view",
      "admin.alerts.view",
      "admin.expenses.view",
      "users.view",
      "users.online.view",
      "radius.settings.view",
      "radius.nas.view",
      "radius.profiles.view",
      "billing.invoiceUpload.create",
      "billing.externalInvoices.view",
      "billing.externalInvoices.viewTotals",
      "billing.collections.view",
      "dashboard.widget.totalAmount",
      "dashboard.widget.invoiceCounts"
    ]);

    await insertPerms("support", [
      "admin.alerts.view",
      "admin.expenses.view",
      "users.view",
      "users.online.view",
      "radius.settings.view",
      "radius.nas.view",
      "radius.profiles.view",
      "billing.externalInvoices.view",
      "billing.externalInvoices.viewTotals",
      "billing.collections.view",
      "dashboard.widget.totalAmount",
      "dashboard.widget.invoiceCounts"
    ]);

    await insertPerms("collector", [
      "billing.externalInvoices.view",
      "billing.collections.view",
      "dashboard.widget.invoiceCounts"
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_permission_overrides`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
  }
}

