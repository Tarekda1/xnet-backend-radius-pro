import { Request, Response } from "express";
import { SessionTracking } from "../db/entities/SessionTracking";
import { Brackets, Repository } from "typeorm";
import { AppDataSource } from "../db/config";
import { Radusagestats } from "../db/entities/Radusagestats";
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { Radprofile } from "../db/entities/Radprofile";
import { UserDetails } from "../db/entities/UserDetails";
import { getOnlineUsers } from "../repo/onlineUsers";
import eventBus from "../bus/eventBusSingleton";
import { ConnectionLogs } from "../db/entities/ConnectionLogs";
import { Radacct } from "../db/entities/Radacct";
import { Nas } from "../db/entities/Nas";
import { UserController } from "./userController";

export const healthCheck = (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
};

export const getLiveSessionDetail = async (req: Request, res: Response) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      res.status(400).json({ success: false, message: "username is required" });
      return;
    }

    const role = (req.user as any)?.role as string | undefined;
    const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
    const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
    const isReseller = role === "reseller" && !!resellerId;

    const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
    const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
    const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

    const repo = AppDataSource.getRepository(SessionTracking);
    const qb = repo
      .createQueryBuilder("session")
      .leftJoin(Raduserprofile, "userProfile", "session.username = userProfile.username")
      .leftJoin(Radprofile, "profile", "userProfile.profile_id = profile.id")
      .leftJoin(UserDetails, "userDetails", "session.username = userDetails.username")
      .leftJoin(
        Radacct,
        "raLive",
        "raLive.acctsessionid = session.session_id AND raLive.acctstoptime IS NULL AND COALESCE(raLive.acctupdatetime, raLive.acctstarttime) >= :staleCutoff",
        { staleCutoff }
      )
      .select([
        "session.username AS username",
        "session.session_id AS sessionId",
        "session.macAddress AS macAddress",
        "session.status AS status",
        "session.startTime AS startTime",
        "session.lastUpdate AS lastUpdate",
        "session.sessionTime AS sessionTime",
        "COALESCE(raLive.nasipaddress, NULL) AS nasIpAddress",
        "COALESCE(raLive.framedipaddress, NULL) AS framedIpAddress",
        "COALESCE(raLive.callingstationid, NULL) AS callingStationId",
        "COALESCE(raLive.acctstarttime, NULL) AS acctStartTime",
        "COALESCE(raLive.acctupdatetime, NULL) AS acctUpdateTime",
        "COALESCE(raLive.acctinputoctets, 0) AS totalBytesIn",
        "COALESCE(raLive.acctoutputoctets, 0) AS totalBytesOut",
        "profile.profile_name AS profileName",
        "profile.daily_quota AS dailyQuota",
        "profile.monthly_quota AS monthlyQuota",
        "COALESCE(userProfile.is_fallback, 0) AS isFallback",
        "userDetails.fullName AS fullName",
      ])
      .where("session.status = 'active'")
      .andWhere("session.username = :username", { username })
      .andWhere(
        `EXISTS (
           SELECT 1
           FROM radacct ra
           WHERE ra.acctsessionid = session.session_id
             AND ra.acctstoptime IS NULL
             AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff
         )`,
        { staleCutoff }
      );

    if (isReseller) {
      qb.andWhere("userProfile.owner_reseller_id = :rid", { rid: resellerId });
    }

    const row = await qb.getRawOne<any>();
    if (!row) {
      res.status(404).json({ success: false, message: "No live session found" });
      return;
    }

    res.status(200).json({ success: true, message: "Live session fetched", data: row });
  } catch (error) {
    console.error("Error fetching live session detail:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getUserRejects = async (req: Request, res: Response) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      res.status(400).json({ success: false, message: "username is required" });
      return;
    }

    const limitRaw = parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const role = (req.user as any)?.role as string | undefined;
    const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
    const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
    const isReseller = role === "reseller" && !!resellerId;

    const repo = AppDataSource.getRepository(ConnectionLogs);
    const qb = repo
      .createQueryBuilder("cl")
      .select([
        "cl.timestamp AS timestamp",
        "cl.nasIp AS nasIp",
        "cl.macAddress AS macAddress",
        "cl.status AS status",
      ])
      .where("cl.username = :username", { username })
      .andWhere("cl.status IN ('rejected','timeout','error')")
      .orderBy("cl.timestamp", "DESC")
      .limit(limit);

    if (isReseller) {
      qb.innerJoin(
        Raduserprofile,
        "u",
        "u.username = cl.username AND u.owner_reseller_id = :rid",
        { rid: resellerId }
      );
    }

    const rows = await qb.getRawMany();
    res.status(200).json({ success: true, message: "Rejects fetched", data: rows });
  } catch (error) {
    console.error("Error fetching rejects:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getOnlineUsersWithUsage = async (req: Request, res: Response) => {
  try {
    const role = (req.user as any)?.role as string | undefined;
    const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
    const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
    const isReseller = role === "reseller" && !!resellerId;

    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const firstDayOfMonth = new Date(today);
    firstDayOfMonth.setDate(1);
    const firstDayOfMonthStr = firstDayOfMonth.toISOString().split("T")[0]; // YYYY-MM-DD

    // 🔹 Get pagination parameters
    let page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string || "").trim().toLowerCase();
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    const offset = (page - 1) * limit;

    const radacctRepo = AppDataSource.getRepository(Radacct);

    // A session can be left "active" in DB if the NAS never sends Stop (power loss, crash, etc).
    // Treat sessions as "online" only if we saw a recent update.
    // For PPP AAA interim-update=1m, a 5m window is a safe default.
    const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
    const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
    const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

    // 🔹 Count total online users (source of truth: open + fresh radacct)
    const totalQb = radacctRepo
      .createQueryBuilder("ra")
      .leftJoin(Raduserprofile, "userProfile", "ra.username = userProfile.username")
      .leftJoin(UserDetails, "userDetails", "ra.username = userDetails.username")
      .select("COUNT(DISTINCT ra.username)", "cnt")
      .where("ra.acctstoptime IS NULL")
      .andWhere("COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff", { staleCutoff });

    if (search) {
      totalQb.andWhere(
        new Brackets((qb) => {
          qb.where("LOWER(ra.username) LIKE :search", { search: `%${search}%` }).orWhere(
            "LOWER(userDetails.full_name) LIKE :search",
            { search: `%${search}%` }
          );
        })
      );
    }

    if (isReseller) {
      totalQb.andWhere("userProfile.owner_reseller_id = :rid", { rid: resellerId });
    }

    const totalUsersRow = await totalQb.getRawOne<{ cnt: string }>();

    const totalUsers = Number(totalUsersRow?.cnt ?? 0);

    // A smaller window for "active" vs "idle" display. Still included as long as within staleCutoff.
    const activeSecondsRaw = parseInt(process.env.ONLINE_SESSION_ACTIVE_SECONDS || "120", 10);
    const activeSeconds = Number.isFinite(activeSecondsRaw) && activeSecondsRaw > 0 ? activeSecondsRaw : 120;
    const activeCutoff = new Date(Date.now() - activeSeconds * 1000);

    // 🔹 Query online users with daily & monthly usage (base: radacct)
    const users = await radacctRepo
      .createQueryBuilder("ra")
      .leftJoin(SessionTracking, "st", "st.session_id = ra.acctsessionid AND st.username = ra.username")
      .leftJoinAndSelect(Radusagestats, "usage", "ra.username = usage.username AND usage.day = :today", { today })
      .leftJoin(
        (qb) =>
          qb
            .from(SessionTracking, "du")
            .select([
              "du.username AS du_username",
              "SUM(COALESCE(du.bytes_in, 0) + COALESCE(du.bytes_out, 0)) AS daily_usage",
            ])
            // Daily usage definition (per user request):
            // - only sessions that STARTED today
            // - and are still open (end_time IS NULL)
            .where("du.startTime >= :todayStart AND du.startTime < :tomorrowStart")
            .andWhere("du.endTime IS NULL")
            .groupBy("du.username"),
        "dailyUsage",
        "ra.username = dailyUsage.du_username"
      )
      .leftJoin(qb =>
        qb.from(Radusagestats, "monthlyUsage")
          .select([
            "monthlyUsage.username AS monthly_username",
            "SUM(monthlyUsage.data_usage) AS monthly_usage"
          ])
          .where("monthlyUsage.day BETWEEN :firstDayOfMonth AND :today", { firstDayOfMonth: firstDayOfMonthStr, today })
          .groupBy("monthlyUsage.username"),
        "monthlyUsage",
        "ra.username = monthlyUsage.monthly_username"
      )
      .leftJoin(Raduserprofile, "userProfile", "ra.username = userProfile.username")
      .leftJoin(Radprofile, "profile", "userProfile.profileId = profile.id")
      .leftJoinAndMapOne(
        "user.userDetails",
        UserDetails,
        "userDetails",
        "ra.username = userDetails.username"
      )
      .select([
        "ra.username AS session_username",
        "COALESCE(st.mac_address, ra.callingstationid, '') AS session_mac_address",
        "ra.acctstarttime AS session_start_time",
        "COALESCE(ra.acctupdatetime, ra.acctstarttime) AS session_last_update",
        "ra.acctsessiontime AS session_session_time",
        "CASE WHEN COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :activeCutoff THEN 'active' ELSE 'idle' END AS session_status",
        // Live counters from radacct (used by frontend to calculate real-time traffic rate)
        "COALESCE(ra.acctinputoctets, 0) AS total_bytes_in",
        "COALESCE(ra.acctoutputoctets, 0) AS total_bytes_out",
        "COALESCE(dailyUsage.daily_usage, 0) AS total_daily_usage",
        "COALESCE(usage.data_usage, 0) AS real_time_data_usage",
        "COALESCE(monthlyUsage.monthly_usage, 0) AS monthly_usage",
        "profile.profileName AS profile_profile_name",
        "profile.dailyQuota AS profile_daily_quota",
        "profile.monthlyQuota AS profile_monthly_quota",
        "COALESCE(userProfile.is_fallback, 0) AS is_fallback",
        "GREATEST(profile.dailyQuota - COALESCE(usage.data_usage, 0), 0) AS remaining_daily_quota",
        "GREATEST(profile.monthlyQuota - COALESCE(monthlyUsage.monthly_usage, 0), 0) AS remaining_monthly_quota",
        "userDetails.fullName AS userDetails_full_name",
      ])
      .where("ra.acctstoptime IS NULL")
      .andWhere("COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff", { staleCutoff })
      .andWhere(new Brackets(qb => {
        qb.where("LOWER(ra.username) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(userDetails.fullName) LIKE :search", { search: `%${search}%` });
      }))
      .andWhere(new Brackets((qb) => {
        if (!isReseller) return;
        qb.where("userProfile.owner_reseller_id = :rid", { rid: resellerId });
      }))
      .groupBy(`ra.username, ra.acctsessionid, ra.callingstationid, ra.acctstarttime, ra.acctupdatetime, ra.acctsessiontime,
        st.mac_address,
        ra.acctinputoctets, ra.acctoutputoctets,
        usage.data_usage, monthlyUsage.monthly_usage, dailyUsage.daily_usage,
        profile.profileName, profile.dailyQuota, profile.monthlyQuota, userProfile.is_fallback,
        userDetails.fullName`)
      .orderBy("COALESCE(ra.acctupdatetime, ra.acctstarttime)", "DESC")
      .limit(limit)
      .offset(offset)
      .setParameters({ todayStart, tomorrowStart, activeCutoff })
      .getRawMany();

    res.status(200).json({
      success: true,
      message: "Online users fetched successfully",
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
      limit,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getOnlineUsersMetrics = async (req: Request, res: Response) => {
  const role = (req.user as any)?.role as string | undefined;
  const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
  const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
  const isReseller = role === "reseller" && !!resellerId;

  const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
  const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
  const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

  if (!isReseller) {
    const metrics = await getOnlineUsers();
    res.status(200).json({
      success: true,
      message: "Online users fetched successfully",
      data: metrics,
    });
    return;
  }

  // Reseller-scoped metrics: count only reseller-owned users with open+fresh radacct
  const raRepo = AppDataSource.getRepository(Radacct);
  const row = await raRepo
    .createQueryBuilder("ra")
    .innerJoin(Raduserprofile, "u", "u.username = ra.username AND u.owner_reseller_id = :rid", { rid: resellerId })
    .select("COUNT(DISTINCT ra.username)", "totalOnlineUsers")
    .addSelect("COUNT(DISTINCT ra.username)", "totalActiveUsers")
    .where("ra.acctstoptime IS NULL")
    .andWhere("COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff", { staleCutoff })
    .getRawOne<{ totalOnlineUsers: string; totalActiveUsers: string }>();

  res.status(200).json({
    success: true,
    message: "Online users fetched successfully",
    data: {
      totalOnlineUsers: Number(row?.totalOnlineUsers ?? 0),
      totalActiveUsers: Number(row?.totalActiveUsers ?? 0),
    },
  });
};

export const getUserSessions = async (req: Request, res: Response) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      res.status(400).json({ success: false, message: "username is required" });
      return;
    }

    const role = (req.user as any)?.role as string | undefined;
    const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
    const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
    const isReseller = role === "reseller" && !!resellerId;

    let page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 200) limit = 200;
    const offset = (page - 1) * limit;

    const repo = AppDataSource.getRepository(Radacct);

    const baseQb = repo
      .createQueryBuilder("ra")
      .where("ra.username = :username", { username });

    // Prefer session_tracking counters (can be 64-bit) when available,
    // because radacct octets can under/over-report depending on NAS counters & schema.
    baseQb.leftJoin(
      SessionTracking,
      "st",
      "st.session_id = ra.acctsessionid AND st.username = ra.username"
    );

    // Reseller scoping: user must belong to the reseller
    if (isReseller) {
      baseQb.innerJoin(
        Raduserprofile,
        "u",
        "u.username = ra.username AND u.owner_reseller_id = :rid",
        { rid: resellerId }
      );
    }

    const totalRow = await baseQb
      .clone()
      .select("COUNT(*)", "cnt")
      .getRawOne<{ cnt: string }>();

    const totalSessions = Number(totalRow?.cnt ?? 0);

    const sessions = await baseQb
      .clone()
      .select([
        "ra.acctsessionid AS session_id",
        "ra.acctstarttime AS start_time",
        "ra.acctstoptime AS stop_time",
        "ra.acctsessiontime AS session_time",
        "COALESCE(st.bytes_in, ra.acctinputoctets, 0) AS bytes_in",
        "COALESCE(st.bytes_out, ra.acctoutputoctets, 0) AS bytes_out",
        "(COALESCE(st.bytes_in, ra.acctinputoctets, 0) + COALESCE(st.bytes_out, ra.acctoutputoctets, 0)) AS total_bytes",
      ])
      .orderBy("ra.acctstarttime", "DESC")
      .limit(limit)
      .offset(offset)
      .getRawMany();

    res.status(200).json({
      success: true,
      message: "User sessions fetched successfully",
      data: {
        username,
        totalSessions,
        totalPages: Math.ceil(totalSessions / limit),
        currentPage: page,
        limit,
        sessions,
      },
    });
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const disconnectOnlineUser = async (req: Request, res: Response) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : undefined;
    const code = typeof req.body?.code === "string" ? req.body.code : undefined;
    const portRaw = req.body?.port;
    const port = typeof portRaw === "number" ? portRaw : Number(portRaw);

    if (!username) {
      res.status(400).json({ success: false, message: "username is required" });
      return;
    }

    // Reseller scoping: reseller can only disconnect their own users
    const role = (req.user as any)?.role as string | undefined;
    const resellerIdRaw = (req.user as any)?.resellerId as number | null | undefined;
    const resellerId = typeof resellerIdRaw === "number" && Number.isFinite(resellerIdRaw) ? resellerIdRaw : null;
    const isReseller = role === "reseller" && !!resellerId;

    if (isReseller) {
      const uRepo = AppDataSource.getRepository(Raduserprofile);
      const u = await uRepo.findOne({ where: { username, ownerResellerId: resellerId } as any });
      if (!u) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
    }

    // Prefer direct disconnect so UI action does not depend on RabbitMQ/consumer being connected.
    // We still allow optional ip/code/port from older clients, but we can also look these up safely server-side.
    let nasIpToUse = ip;
    let secretToUse = code;

    if (!nasIpToUse || !secretToUse) {
      const raRepo = AppDataSource.getRepository(Radacct);
      const active = await raRepo
        .createQueryBuilder("ra")
        .select(["ra.nasipaddress AS nasipaddress"])
        .where("ra.username = :username", { username })
        .andWhere("ra.acctstoptime IS NULL")
        .orderBy("ra.acctstarttime", "DESC")
        .limit(1)
        .getRawOne<{ nasipaddress?: string }>();

      if (!nasIpToUse) nasIpToUse = String(active?.nasipaddress ?? "").trim() || undefined;
      if (nasIpToUse && !secretToUse) {
        const nasRepo = AppDataSource.getRepository(Nas);
        const nas = await nasRepo.findOne({ where: { nasname: nasIpToUse } as any });
        secretToUse = nas?.secret;
      }
    }

    const disconnectPromise = UserController.disconnectUser(
      username,
      nasIpToUse,
      secretToUse,
      Number.isFinite(port) ? port : undefined
    );

    // Do not let the HTTP request hang forever; return quickly.
    const waitMsRaw = parseInt(process.env.DISCONNECT_HTTP_WAIT_MS || "3000", 10);
    const waitMs = Number.isFinite(waitMsRaw) && waitMsRaw > 0 ? waitMsRaw : 3000;

    let responded = false;
    const timer = setTimeout(() => {
      if (responded) return;
      responded = true;
      res.status(202).json({ success: true, message: "Disconnect started" });
    }, waitMs);

    try {
      const result = await disconnectPromise;
      if (responded) return; // already returned 202
      responded = true;
      clearTimeout(timer);

      if (!result.ok) {
        res.status(500).json({ success: false, message: result.error });
        return;
      }
      res.status(200).json({ success: true, message: "Disconnect sent", data: result });
    } finally {
      clearTimeout(timer);
      // If we already responded 202, still log the eventual outcome for debugging.
      if (responded) {
        disconnectPromise
          .then((r) => {
            if (!r.ok) console.error(`❌ Disconnect finished with error for ${username}:`, r.error);
          })
          .catch((e) => console.error(`❌ Disconnect promise rejected for ${username}:`, e));
      }
    }
  } catch (error) {
    console.error("Error disconnecting user:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getAuthMetrics = async (req: Request, res: Response) => {
  try {
    const windowSecondsRaw = parseInt((req.query.windowSeconds as string) || "86400", 10);
    const windowSeconds = Number.isFinite(windowSecondsRaw) && windowSecondsRaw > 0 ? windowSecondsRaw : 86400;

    const now = Date.now();
    const windowStart = new Date(now - windowSeconds * 1000);
    const prevStart = new Date(now - windowSeconds * 2 * 1000);
    const prevEnd = windowStart;

    const repo = AppDataSource.getRepository(ConnectionLogs);

    const getCounts = async (start: Date, end: Date) => {
      // Use SUM(status='x') which returns 0/1 per row in MySQL
      const row = await repo
        .createQueryBuilder("cl")
        .select("COALESCE(SUM(cl.status = 'attempt'), 0)", "attempts")
        .addSelect("COALESCE(SUM(cl.status = 'accepted'), 0)", "accepted")
        .addSelect("COALESCE(SUM(cl.status = 'rejected'), 0)", "rejected")
        .where("cl.timestamp >= :start", { start })
        .andWhere("cl.timestamp < :end", { end })
        .getRawOne<{ attempts: string; accepted: string; rejected: string }>();

      return {
        attempts: Number(row?.attempts ?? 0),
        accepted: Number(row?.accepted ?? 0),
        rejected: Number(row?.rejected ?? 0),
      };
    };

    const current = await getCounts(windowStart, new Date(now));
    const previous = await getCounts(prevStart, prevEnd);

    const pct = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    res.status(200).json({
      success: true,
      data: {
        windowSeconds,
        current,
        previous,
        changePct: {
          attempts: pct(current.attempts, previous.attempts),
          rejected: pct(current.rejected, previous.rejected),
          accepted: pct(current.accepted, previous.accepted),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching auth metrics:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



