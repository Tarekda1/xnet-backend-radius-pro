import { MigrationInterface, QueryRunner } from "typeorm";
import { PERMISSIONS } from "../../access/permissions";

export class SeedResellerPermissions1736632600000 implements MigrationInterface {
  name = "SeedResellerPermissions1736632600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure roles exist (admin already exists from previous migration)
    // Add reseller role if missing.
    await queryRunner.query(
      `
      INSERT INTO roles (\`key\`, name, description)
      SELECT 'reseller', 'Reseller', 'Reseller account'
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE \`key\` = 'reseller');
    `
    );

    // Helper: ensure all permissions exist for admin role
    // We'll add reseller-related permissions to admin by default.
    const resellerPermsForAdmin = [
      "admin.resellers.manage",
      "admin.resellers.fund",
    ];

    // Add permissions to reseller role baseline
    const resellerBaseline = [
      "reseller.portal.access",
      "reseller.balance.view",
      "reseller.users.view",
      "reseller.users.manage",
    ];

    // Validate permissions exist in registry; if not, migration should fail early
    for (const p of [...resellerPermsForAdmin, ...resellerBaseline]) {
      if (!PERMISSIONS.includes(p as any)) {
        throw new Error(`Permission not registered in PERMISSIONS: ${p}`);
      }
    }

    // Insert role_permissions rows (idempotent)
    await queryRunner.query(
      `
      INSERT INTO role_permissions (roleId, permission)
      SELECT r.id, p.permission
      FROM roles r
      JOIN (
        SELECT ? AS permission
        UNION ALL SELECT ?
      ) p
      WHERE r.\`key\` = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp WHERE rp.roleId = r.id AND rp.permission = p.permission
      );
    `,
      resellerPermsForAdmin
    );

    await queryRunner.query(
      `
      INSERT INTO role_permissions (roleId, permission)
      SELECT r.id, p.permission
      FROM roles r
      JOIN (
        SELECT ? AS permission
        UNION ALL SELECT ?
        UNION ALL SELECT ?
        UNION ALL SELECT ?
      ) p
      WHERE r.\`key\` = 'reseller'
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp WHERE rp.roleId = r.id AND rp.permission = p.permission
      );
    `,
      resellerBaseline
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove permissions from reseller role (keep role row)
    await queryRunner.query(
      `
      DELETE rp FROM role_permissions rp
      JOIN roles r ON rp.roleId = r.id
      WHERE r.\`key\` = 'reseller'
      AND rp.permission IN ('reseller.portal.access','reseller.balance.view','reseller.users.view','reseller.users.manage');
    `
    );

    // Remove reseller admin perms
    await queryRunner.query(
      `
      DELETE rp FROM role_permissions rp
      JOIN roles r ON rp.roleId = r.id
      WHERE r.\`key\` = 'admin'
      AND rp.permission IN ('admin.resellers.manage','admin.resellers.fund');
    `
    );

    // Optionally remove reseller role row if empty
    await queryRunner.query(
      `
      DELETE FROM roles WHERE \`key\` = 'reseller';
    `
    );
  }
}

