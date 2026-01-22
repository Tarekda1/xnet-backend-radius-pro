import { Request, Response } from "express";
import { AppDataSource } from "../db/config";
import { Logs } from "../db/entities/Logs";

const sendResponse = (res: Response, success: boolean, status: number, message: string, data: any = null) => {
  res.status(status).json({ success, message, data });
};

/**
 * Minimal audit-log listing endpoint.
 * We store audit events as rows in the existing `radius.logs` table with:
 * - level: "info"
 * - message: "audit.<action>"
 * - meta: { requestId, actor, targets, ... }
 */
export async function listAudit(req: Request, res: Response) {
  try {
    const limitRaw = parseInt(String(req.query.limit ?? "200"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const targetUsername = String(req.query.targetUsername ?? "").trim();
    const actorUsername = String(req.query.actorUsername ?? "").trim();
    const actionRaw = String(req.query.action ?? "").trim(); // supports "users.bulk.delete" or "audit.users.bulk.delete"
    const actionPrefixRaw = String(req.query.actionPrefix ?? "").trim(); // supports prefix like "users.bulk."
    const fromRaw = String(req.query.from ?? "").trim(); // ISO string or epoch ms
    const toRaw = String(req.query.to ?? "").trim(); // ISO string or epoch ms

    const parseDate = (raw: string): Date | null => {
      if (!raw) return null;
      // epoch ms
      if (/^\d{10,}$/.test(raw)) {
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        const d = new Date(n);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      const t = Date.parse(raw);
      if (Number.isNaN(t)) return null;
      return new Date(t);
    };

    const from = parseDate(fromRaw);
    const to = parseDate(toRaw);
    const action =
      actionRaw.length === 0 ? "" : actionRaw.startsWith("audit.") ? actionRaw : `audit.${actionRaw}`;
    const actionPrefix =
      actionPrefixRaw.length === 0
        ? ""
        : actionPrefixRaw.startsWith("audit.")
          ? actionPrefixRaw
          : `audit.${actionPrefixRaw}`;

    const repo = AppDataSource.getRepository(Logs);
    const qb = repo
      .createQueryBuilder("l")
      .where("l.message LIKE :prefix", { prefix: "audit.%" });

    // Optional server-side filtering by targetUsername.
    // We store:
    // - meta.targets: string[]
    // - optionally meta.target.username: string (future)
    //
    // MySQL JSON usage:
    // - JSON_CONTAINS(meta, JSON_QUOTE('alice'), '$.targets')
    // - JSON_UNQUOTE(JSON_EXTRACT(meta, '$.target.username')) = 'alice'
    if (targetUsername) {
      qb.andWhere(
        `(JSON_CONTAINS(l.meta, JSON_QUOTE(:targetUsername), '$.targets') OR JSON_UNQUOTE(JSON_EXTRACT(l.meta, '$.target.username')) = :targetUsername)`,
        { targetUsername }
      );
    }

    if (actorUsername) {
      qb.andWhere(`JSON_UNQUOTE(JSON_EXTRACT(l.meta, '$.actor.username')) = :actorUsername`, { actorUsername });
    }

    if (action) {
      qb.andWhere(`l.message = :action`, { action });
    } else if (actionPrefix) {
      qb.andWhere(`l.message LIKE :actionPrefix`, { actionPrefix: `${actionPrefix}%` });
    }

    if (from) {
      qb.andWhere(`l.timestamp >= :from`, { from });
    }
    if (to) {
      qb.andWhere(`l.timestamp <= :to`, { to });
    }

    const rows = await qb.orderBy("l.timestamp", "DESC").limit(limit).getMany();

    return sendResponse(res, true, 200, "Audit events fetched", rows);
  } catch (e) {
    console.error("listAudit failed:", e);
    return sendResponse(res, false, 500, "Failed to fetch audit events");
  }
}

