import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogIndexes1760000000000 implements MigrationInterface {
  name = "AddAuditLogIndexes1760000000000";

  private async indexExists(queryRunner: QueryRunner, indexName: string): Promise<boolean> {
    const rows = await queryRunner.query(
      `
      SELECT COUNT(*) AS cnt
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'logs'
        AND index_name = ?;
      `,
      [indexName]
    );
    const cnt = Number(rows?.[0]?.cnt ?? 0);
    return cnt > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Speed up /api/audit (listAudit):
    // - WHERE message LIKE 'audit.%'
    // - ORDER BY timestamp DESC LIMIT N
    //
    // Composite index allows efficient prefix scan + ordered pagination.
    if (!(await this.indexExists(queryRunner, "idx_logs_message_timestamp"))) {
      await queryRunner.query(`ALTER TABLE logs ADD INDEX idx_logs_message_timestamp (message, timestamp);`);
    }
    if (!(await this.indexExists(queryRunner, "idx_logs_timestamp"))) {
      await queryRunner.query(`ALTER TABLE logs ADD INDEX idx_logs_timestamp (timestamp);`);
    }
    if (!(await this.indexExists(queryRunner, "idx_logs_level_timestamp"))) {
      await queryRunner.query(`ALTER TABLE logs ADD INDEX idx_logs_level_timestamp (level, timestamp);`);
    }

    // Optional: fast filter by actor username (when UI filters by actorUsername).
    // MySQL 8+ supports functional indexes.
    if (!(await this.indexExists(queryRunner, "idx_logs_actor_username"))) {
      await queryRunner.query(`
        CREATE INDEX idx_logs_actor_username
        ON logs ((CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.actor.username')) AS CHAR(128))));
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop functional index first
    if (await this.indexExists(queryRunner, "idx_logs_actor_username")) {
      await queryRunner.query(`DROP INDEX idx_logs_actor_username ON logs;`);
    }

    if (await this.indexExists(queryRunner, "idx_logs_message_timestamp")) {
      await queryRunner.query(`ALTER TABLE logs DROP INDEX idx_logs_message_timestamp;`);
    }
    if (await this.indexExists(queryRunner, "idx_logs_timestamp")) {
      await queryRunner.query(`ALTER TABLE logs DROP INDEX idx_logs_timestamp;`);
    }
    if (await this.indexExists(queryRunner, "idx_logs_level_timestamp")) {
      await queryRunner.query(`ALTER TABLE logs DROP INDEX idx_logs_level_timestamp;`);
    }
  }
}

