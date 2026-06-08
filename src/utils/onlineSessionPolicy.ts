/**
 * Shared rules for deciding whether a radacct row represents a live session.
 *
 * Many NAS devices (e.g. Mikrotik without Interim-Update) leave acctupdatetime NULL
 * while the session stays open. The legacy rule
 *   COALESCE(acctupdatetime, acctstarttime) >= staleCutoff
 * drops those rows after a few minutes even though acctstoptime IS NULL.
 */

export type OnlineSessionConfig = {
  staleSeconds: number;
  activeSeconds: number;
  staleCutoff: Date;
  activeCutoff: Date;
};

export function readOnlineSessionConfig(): OnlineSessionConfig {
  const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
  const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
  const activeSecondsRaw = parseInt(process.env.ONLINE_SESSION_ACTIVE_SECONDS || "120", 10);
  const activeSeconds = Number.isFinite(activeSecondsRaw) && activeSecondsRaw > 0 ? activeSecondsRaw : 120;
  const now = Date.now();
  return {
    staleSeconds,
    activeSeconds,
    staleCutoff: new Date(now - staleSeconds * 1000),
    activeCutoff: new Date(now - activeSeconds * 1000),
  };
}

/** Include open radacct rows; trust acctstoptime IS NULL when acctupdatetime is never sent. */
export function sqlRadacctIsOnline(alias: string): string {
  return `(
    ${alias}.acctstoptime IS NULL
    AND (
      (${alias}.acctupdatetime IS NOT NULL AND ${alias}.acctupdatetime >= :staleCutoff)
      OR (${alias}.acctupdatetime IS NULL AND ${alias}.acctstarttime >= :staleCutoff)
      OR (${alias}.acctupdatetime IS NULL)
    )
  )`;
}

/** Recently active (for "active now" KPIs). */
export function sqlRadacctIsActive(alias: string): string {
  return `(
    ${alias}.acctstoptime IS NULL
    AND (
      (${alias}.acctupdatetime IS NOT NULL AND ${alias}.acctupdatetime >= :activeCutoff)
      OR (${alias}.acctupdatetime IS NULL AND ${alias}.acctstarttime >= :activeCutoff)
    )
  )`;
}

export function sqlRadacctLastUpdate(alias: string): string {
  return `COALESCE(${alias}.acctupdatetime, ${alias}.acctstarttime)`;
}

export function sqlSessionStatusCase(alias: string): string {
  const last = sqlRadacctLastUpdate(alias);
  return `CASE WHEN ${last} >= :activeCutoff THEN 'active' ELSE 'idle' END`;
}
