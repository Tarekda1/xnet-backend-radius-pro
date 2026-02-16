import { MigrationInterface, QueryRunner } from "typeorm";
import { PERMISSIONS } from "../../access/permissions";

const QUOTA_PERMS = ["users.resetDailyQuota", "users.resetMonthlyQuota"] as const;

export class AddQuotaResetPermissions1769900001000 implements MigrationInterface {
  name = "AddQuotaResetPermissions1769900001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const p of QUOTA_PERMS) {
      if (!PERMISSIONS.includes(p as any)) {
        throw new Error(`Permission not registered in PERMISSIONS: ${p}`);
      }
    }

    // Add to roles that have users.view or reseller.users.manage (backward compat)
    const roles = (await queryRunner.query(
      `SELECT DISTINCT r.id FROM roles r
       LEFT JOIN role_permissions rp ON rp.roleId = r.id AND rp.permission IN ('users.view', 'reseller.users.manage')
       WHERE rp.permission IS NOT NULL`
    )) as Array<{ id: number }>;

    for (const r of roles) {
      const roleId = Number(r.id);
      if (!Number.isFinite(roleId)) continue;
      for (const p of QUOTA_PERMS) {
        await queryRunner.query(
          `INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)`,
          [roleId, p]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE permission IN (?, ?)`,
      [...QUOTA_PERMS]
    );
  }
}
