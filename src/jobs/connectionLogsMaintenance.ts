import cron from "node-cron";
import { AppDataSource } from "../db/config";

const DEFAULT_RAW_RETENTION_DAYS = 7;
const DEFAULT_SUMMARY_RETENTION_DAYS = 180;
const DEFAULT_CLEANUP_BATCH_SIZE = 10_000;
const DEFAULT_CLEANUP_MAX_BATCHES = 20;

function envInt(name: string, fallback: number): number {
  const value = parseInt(String(process.env[name] ?? ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function floorToHour(date: Date): Date {
  const out = new Date(date);
  out.setMinutes(0, 0, 0);
  return out;
}

export async function refreshConnectionLogHourlyStats(hoursBack = 2): Promise<number> {
  if (!AppDataSource.isInitialized) return 0;

  const start = floorToHour(new Date(Date.now() - Math.max(1, hoursBack) * 60 * 60 * 1000));
  const result = await AppDataSource.query(
    `
      INSERT INTO connection_log_hourly_stats
        (bucket, attempts, accepted, rejected, timeout, error, total)
      SELECT
        STR_TO_DATE(DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00'), '%Y-%m-%d %H:%i:%s') AS bucket,
        COALESCE(SUM(status = 'attempt'), 0) AS attempts,
        COALESCE(SUM(status = 'accepted'), 0) AS accepted,
        COALESCE(SUM(status = 'rejected'), 0) AS rejected,
        COALESCE(SUM(status = 'timeout'), 0) AS timeout,
        COALESCE(SUM(status = 'error'), 0) AS error,
        COUNT(*) AS total
      FROM connection_logs
      WHERE timestamp >= ?
      GROUP BY bucket
      ON DUPLICATE KEY UPDATE
        attempts = VALUES(attempts),
        accepted = VALUES(accepted),
        rejected = VALUES(rejected),
        timeout = VALUES(timeout),
        error = VALUES(error),
        total = VALUES(total),
        updated_at = CURRENT_TIMESTAMP
    `,
    [start]
  );

  return Number(result?.affectedRows ?? result?.[0]?.affectedRows ?? 0);
}

export async function cleanupConnectionLogs(): Promise<{
  rawDeleted: number;
  summaryDeleted: number;
}> {
  if (!AppDataSource.isInitialized) return { rawDeleted: 0, summaryDeleted: 0 };

  const rawRetentionDays = envInt("CONNECTION_LOGS_RETENTION_DAYS", DEFAULT_RAW_RETENTION_DAYS);
  const summaryRetentionDays = envInt("CONNECTION_LOGS_SUMMARY_RETENTION_DAYS", DEFAULT_SUMMARY_RETENTION_DAYS);
  const batchSize = envInt("CONNECTION_LOGS_CLEANUP_BATCH_SIZE", DEFAULT_CLEANUP_BATCH_SIZE);
  const maxBatches = envInt("CONNECTION_LOGS_CLEANUP_MAX_BATCHES", DEFAULT_CLEANUP_MAX_BATCHES);

  const rawCutoff = new Date(Date.now() - rawRetentionDays * 24 * 60 * 60 * 1000);
  let rawDeleted = 0;

  for (let i = 0; i < maxBatches; i += 1) {
    const result = await AppDataSource.query(
      `
        DELETE FROM connection_logs
        WHERE timestamp < ?
        ORDER BY timestamp
        LIMIT ?
      `,
      [rawCutoff, batchSize]
    );
    const deleted = Number(result?.affectedRows ?? result?.[0]?.affectedRows ?? 0);
    rawDeleted += deleted;
    if (deleted < batchSize) break;
  }

  const summaryCutoff = floorToHour(new Date(Date.now() - summaryRetentionDays * 24 * 60 * 60 * 1000));
  const summaryResult = await AppDataSource.query(
    "DELETE FROM connection_log_hourly_stats WHERE bucket < ?",
    [summaryCutoff]
  );
  const summaryDeleted = Number(summaryResult?.affectedRows ?? summaryResult?.[0]?.affectedRows ?? 0);

  return { rawDeleted, summaryDeleted };
}

export async function runConnectionLogsMaintenance(): Promise<void> {
  const refreshHours = envInt("CONNECTION_LOGS_SUMMARY_REFRESH_HOURS", 2);
  const refreshed = await refreshConnectionLogHourlyStats(refreshHours);
  const cleanup = await cleanupConnectionLogs();

  console.log("[connection-logs] maintenance", {
    refreshed,
    rawDeleted: cleanup.rawDeleted,
    summaryDeleted: cleanup.summaryDeleted,
  });
}

export function startConnectionLogsMaintenanceScheduler(): void {
  const refreshCron = String(process.env.CONNECTION_LOGS_SUMMARY_CRON ?? "*/1 * * * *").trim();
  const cleanupCron = String(process.env.CONNECTION_LOGS_CLEANUP_CRON ?? "20 3 * * *").trim();

  try {
    cron.schedule(refreshCron, async () => {
      try {
        await refreshConnectionLogHourlyStats(envInt("CONNECTION_LOGS_SUMMARY_REFRESH_HOURS", 2));
      } catch (e) {
        console.error("[connection-logs] summary refresh failed", e);
      }
    });
    console.log(`[connection-logs] summary scheduler enabled: ${refreshCron}`);
  } catch (e) {
    console.error("[connection-logs] invalid CONNECTION_LOGS_SUMMARY_CRON", e);
  }

  try {
    cron.schedule(cleanupCron, async () => {
      try {
        const cleanup = await cleanupConnectionLogs();
        console.log("[connection-logs] cleanup completed", cleanup);
      } catch (e) {
        console.error("[connection-logs] cleanup failed", e);
      }
    });
    console.log(`[connection-logs] cleanup scheduler enabled: ${cleanupCron}`);
  } catch (e) {
    console.error("[connection-logs] invalid CONNECTION_LOGS_CLEANUP_CRON", e);
  }

  setTimeout(() => {
    runConnectionLogsMaintenance().catch((e) => console.error("[connection-logs] startup maintenance failed", e));
  }, 10_000);
}
