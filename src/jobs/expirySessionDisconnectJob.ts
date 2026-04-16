import { AppDataSource } from "../db/config";
import { Radacct } from "../db/entities/Radacct";
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { UserController } from "../controllers/userController";
import cacheService from "../services/cacheService";

/**
 * Bulk-flip account_status to expired when expires_at has passed (active rows only),
 * then disconnect still-online sessions so the NAS drops them (RADIUS rejects expired logins).
 * Gated by EXPIRY_DISCONNECT_CRON in server.ts.
 */
export async function runExpirySessionDisconnectJob(): Promise<{
  statusFlipped: number;
  candidates: number;
  attempted: number;
  ok: number;
  failed: number;
}> {
  if (!AppDataSource.isInitialized) {
    console.warn("[expiry-disconnect] skipped: database not initialized yet");
    return { statusFlipped: 0, candidates: 0, attempted: 0, ok: 0, failed: 0 };
  }

  const flip = await AppDataSource.getRepository(Raduserprofile)
    .createQueryBuilder()
    .update(Raduserprofile)
    .set({ accountStatus: "expired" })
    .where("expiresAt IS NOT NULL")
    .andWhere("expiresAt < CURRENT_TIMESTAMP")
    .andWhere("accountStatus = :active", { active: "active" })
    .execute();

  // MySQL driver sometimes exposes row count on raw[0].affectedRows instead of .affected
  let statusFlipped = typeof flip.affected === "number" ? flip.affected : 0;
  if (!statusFlipped && flip.raw && Array.isArray(flip.raw) && (flip.raw[0] as { affectedRows?: number })?.affectedRows != null) {
    statusFlipped = Number((flip.raw[0] as { affectedRows: number }).affectedRows) || 0;
  }

  if (statusFlipped > 0) {
    try {
      const patterns = ["users_page_*", "users_status_*", "user:*", "user_search_*"];
      for (const pattern of patterns) {
        await cacheService.deleteCacheKeys(pattern);
      }
    } catch (e) {
      console.warn("[expiry-disconnect] cache invalidation failed (non-fatal):", e);
    }
  }

  const batchRaw = parseInt(process.env.EXPIRY_DISCONNECT_BATCH || "100", 10);
  const batch = Number.isFinite(batchRaw) && batchRaw > 0 ? Math.min(batchRaw, 500) : 100;

  // Open radacct rows only (acctstoptime IS NULL). Do NOT apply ONLINE_SESSION_STALE_SECONDS here:
  // interim accounting can easily be older than 5 minutes, and those users would never disconnect.

  const rows = await AppDataSource.getRepository(Radacct)
    .createQueryBuilder("ra")
    .select("ra.username", "username")
    .distinct(true)
    .innerJoin(Raduserprofile, "up", "up.username = ra.username")
    .where("ra.acctstoptime IS NULL")
    .andWhere("up.expiresAt IS NOT NULL")
    .andWhere("up.expiresAt < CURRENT_TIMESTAMP")
    .limit(batch)
    .getRawMany<{ username: string }>();

  const usernames = Array.from(
    new Set(rows.map((r) => String(r?.username ?? "").trim()).filter((u) => u.length > 0))
  );

  let ok = 0;
  let failed = 0;
  for (const u of usernames) {
    const result = await UserController.disconnectWithOpenSessionLookup(u);
    if (result.ok) ok += 1;
    else failed += 1;
  }

  const out = { statusFlipped, candidates: usernames.length, attempted: usernames.length, ok, failed };
  console.log("[expiry-disconnect] tick", out);
  return out;
}
