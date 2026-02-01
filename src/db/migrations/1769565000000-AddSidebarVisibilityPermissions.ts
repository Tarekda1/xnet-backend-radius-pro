import { MigrationInterface, QueryRunner } from "typeorm";
import { PERMISSIONS } from "../../access/permissions";

export class AddSidebarVisibilityPermissions1769565000000 implements MigrationInterface {
  name = "AddSidebarVisibilityPermissions1769565000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const navPerms = [
      "ui.sidebar.home.show",
      "ui.sidebar.dashboard.show",
      "ui.sidebar.users.list.show",
      "ui.sidebar.users.online.show",
      "ui.sidebar.users.profiles.show",
      "ui.sidebar.radius.settings.show",
      "ui.sidebar.radius.nas.show",
      "ui.sidebar.billing.invoiceUpload.show",
      "ui.sidebar.billing.externalInvoices.show",
      "ui.sidebar.billing.collections.show",
      "ui.sidebar.admin.analytics.show",
      "ui.sidebar.admin.alerts.show",
      "ui.sidebar.admin.expenses.show",
      "ui.sidebar.admin.authUsers.show",
      "ui.sidebar.admin.access.show",
      "ui.sidebar.admin.backups.show",
      "ui.sidebar.admin.resellers.show",
    ] as const;

    // Ensure permissions are registered (safety like other migrations)
    for (const p of navPerms) {
      if (!PERMISSIONS.includes(p as any)) {
        throw new Error(`Permission not registered in PERMISSIONS: ${p}`);
      }
    }

    const roles = (await queryRunner.query(`SELECT id, \`key\` as roleKey FROM roles`)) as Array<{ id: number; roleKey: string }>;
    for (const r of roles) {
      const roleId = Number((r as any).id);
      if (!Number.isFinite(roleId)) continue;
      for (const p of navPerms) {
        await queryRunner.query(`INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)`, [roleId, p]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE rp FROM role_permissions rp
      WHERE rp.permission LIKE 'ui.sidebar.%';
      `
    );
  }
}

