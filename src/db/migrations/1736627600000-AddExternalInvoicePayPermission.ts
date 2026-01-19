import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalInvoicePayPermission1736627600000 implements MigrationInterface {
  name = "AddExternalInvoicePayPermission1736627600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the new permission to common roles to avoid breaking existing flows.
    // You can still remove it per-role in the Admin UI.
    const rows: Array<{ id: number }> = await queryRunner.query(
      "SELECT id FROM roles WHERE `key` IN ('admin','manager','collector')"
    );

    for (const r of rows) {
      await queryRunner.query(
        "INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)",
        [r.id, "billing.externalInvoices.pay"]
      );
      await queryRunner.query(
        "INSERT IGNORE INTO role_permissions (roleId, permission) VALUES (?, ?)",
        [r.id, "billing.externalInvoices.view"]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: number }> = await queryRunner.query(
      "SELECT id FROM roles WHERE `key` IN ('admin','manager','collector')"
    );
    for (const r of rows) {
      await queryRunner.query(
        "DELETE FROM role_permissions WHERE roleId = ? AND permission = ?",
        [r.id, "billing.externalInvoices.pay"]
      );
    }
  }
}

