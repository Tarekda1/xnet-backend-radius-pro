import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogIndexes1760000000000 implements MigrationInterface {
  name = "AddAuditLogIndexes1760000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Speed up /api/audit (listAudit):
    // - WHERE message LIKE 'audit.%'
    // - ORDER BY timestamp DESC LIMIT N
    //
    // Composite index allows efficient prefix scan + ordered pagination.
    await queryRunner.query(`
      ALTER TABLE logs
        ADD INDEX idx_logs_message_timestamp (message, timestamp),
        ADD INDEX idx_logs_timestamp (timestamp),
        ADD INDEX idx_logs_level_timestamp (level, timestamp);
    `);

    // Optional: fast filter by actor username (when UI filters by actorUsername).
    // MySQL 8+ supports functional indexes.
    await queryRunner.query(`
      CREATE INDEX idx_logs_actor_username
      ON logs ((JSON_UNQUOTE(JSON_EXTRACT(meta, '$.actor.username'))));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop functional index first
    await queryRunner.query(`DROP INDEX idx_logs_actor_username ON logs;`);

    await queryRunner.query(`ALTER TABLE logs DROP INDEX idx_logs_message_timestamp;`);
    await queryRunner.query(`ALTER TABLE logs DROP INDEX idx_logs_timestamp;`);
    await queryRunner.query(`ALTER TABLE logs DROP INDEX idx_logs_level_timestamp;`);
  }
}

