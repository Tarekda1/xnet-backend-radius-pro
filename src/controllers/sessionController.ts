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

export const healthCheck = (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
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
    firstDayOfMonth.setDate(1); // Get the first day of the month
    const firstDayOfMonthStr = firstDayOfMonth.toISOString().split("T")[0];

    // 🔹 Get pagination parameters
    let page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string || "").trim().toLowerCase();
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    const offset = (page - 1) * limit;

    const sessionRepo = AppDataSource.getRepository(SessionTracking);

    // A session can be left "active" in DB if the NAS never sends Stop (power loss, crash, etc).
    // Treat sessions as "online" only if we saw a recent update.
    // For PPP AAA interim-update=1m, a 5m window is a safe default.
    const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
    const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
    const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

    // 🔹 Count total sessions for pagination (this endpoint returns session rows)
    const totalQb = sessionRepo
      .createQueryBuilder("session")
      .leftJoin(Raduserprofile, "userProfile", "session.username = userProfile.username")
      // Join user_details ONLY for filtering; do not select/map it (avoids ONLY_FULL_GROUP_BY issues)
      .leftJoin(UserDetails, "userDetails", "session.username = userDetails.username")
      .select("COUNT(*)", "cnt")
      .where("session.status = :status", { status: "active" })
      // Source of truth for "actually online": there must be a currently-open radacct row
      // for the same Acct-Session-Id, with a recent update.
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

    if (search) {
      totalQb.andWhere(
        new Brackets((qb) => {
          qb.where("LOWER(session.username) LIKE :search", { search: `%${search}%` }).orWhere(
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

    // 🔹 Query online users with daily & monthly usage
    const users = await sessionRepo
      .createQueryBuilder("session")
      .leftJoinAndSelect(Radusagestats, "usage", "session.username = usage.username AND usage.day = :today", { today })
      // Live counters from radacct (Acct-Input/Output-Octets) – these update via interim-updates from NAS.
      // session_tracking bytes_* are not always updated depending on your ingestion pipeline, so prefer radacct.
      .leftJoin(
        "radacct",
        "raLive",
        "raLive.acctsessionid = session.session_id AND raLive.acctstoptime IS NULL AND COALESCE(raLive.acctupdatetime, raLive.acctstarttime) >= :staleCutoff",
        { staleCutoff }
      )
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
        "session.username = dailyUsage.du_username"
      )
      .leftJoin(qb =>
        qb.from(Radusagestats, "monthlyUsage")
          .select([
            "monthlyUsage.username AS monthly_username",
            "SUM(monthlyUsage.data_usage) AS monthly_usage"
          ])
          .where("monthlyUsage.day BETWEEN :firstDayOfMonth AND :today", { firstDayOfMonth: firstDayOfMonthStr, today })
          .groupBy("monthlyUsage.username")
        , "monthlyUsage", "session.username = monthlyUsage.monthly_username")
      .leftJoin(Raduserprofile, "userProfile", "session.username = userProfile.username")
      .leftJoin(Radprofile, "profile", "userProfile.profileId = profile.id")
      .leftJoinAndMapOne(
        "user.userDetails",
        UserDetails,
        "userDetails",
        "session.username = userDetails.username"
      )
      .select([
        "session.username",
        "session.macAddress",
        "session.status",
        "session.startTime",
        "session.lastUpdate",
        "session.sessionTime",
        // Live counters from radacct (used by frontend to calculate real-time traffic rate)
        "COALESCE(raLive.acctinputoctets, 0) AS total_bytes_in",
        "COALESCE(raLive.acctoutputoctets, 0) AS total_bytes_out",
        "COALESCE(dailyUsage.daily_usage, 0) AS total_daily_usage",
        "COALESCE(usage.data_usage, 0) AS real_time_data_usage",
        "COALESCE(monthlyUsage.monthly_usage, 0) AS monthly_usage",
        "profile.profileName",
        "profile.dailyQuota",
        "userProfile.is_fallback",
        "profile.monthlyQuota",
        "GREATEST(profile.dailyQuota - COALESCE(usage.data_usage, 0), 0) AS remaining_daily_quota",
        "GREATEST(profile.monthlyQuota - COALESCE(monthlyUsage.monthly_usage, 0), 0) AS remaining_monthly_quota",
        "userDetails.fullName",
      ])
      .where("session.status = :status", { status: "active" })
      .andWhere(
        `EXISTS (
           SELECT 1
           FROM radacct ra
           WHERE ra.acctsessionid = session.session_id
             AND ra.acctstoptime IS NULL
             AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff
         )`,
        { staleCutoff }
      )
      .andWhere(new Brackets(qb => {
        qb.where("LOWER(session.username) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(userDetails.fullName) LIKE :search", { search: `%${search}%` });
      }))
      .andWhere(new Brackets((qb) => {
        if (!isReseller) return;
        qb.where("userProfile.owner_reseller_id = :rid", { rid: resellerId });
      }))
      .groupBy(`session.username, session.macAddress, session.status, 
        session.startTime, session.lastUpdate,
        session.sessionTime, raLive.acctinputoctets, raLive.acctoutputoctets,
        usage.data_usage, monthlyUsage.monthly_usage, dailyUsage.daily_usage,
        profile.profileName, profile.dailyQuota, profile.monthlyQuota,userProfile.is_fallback`)
      .orderBy("session.startTime", "DESC") // Optional sorting
      .limit(limit)
      .offset(offset)
      .setParameters({ todayStart, tomorrowStart })
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

  // Reseller-scoped metrics: count only sessions for reseller-owned users
  const sessionRepo = AppDataSource.getRepository(SessionTracking);
  const row = await sessionRepo
    .createQueryBuilder("s")
    .leftJoin(Raduserprofile, "u", "s.username = u.username")
    .select([
      "COUNT(DISTINCT s.username) AS totalOnlineUsers",
      "COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.username END) AS totalActiveUsers",
    ])
    .where("s.status = 'active'")
    .andWhere(
      `EXISTS (
         SELECT 1
         FROM radacct ra
         WHERE ra.acctsessionid = s.session_id
           AND ra.acctstoptime IS NULL
           AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff
       )`,
      { staleCutoff }
    )
    .andWhere("u.owner_reseller_id = :rid", { rid: resellerId })
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
        "COALESCE(ra.acctinputoctets, 0) AS bytes_in",
        "COALESCE(ra.acctoutputoctets, 0) AS bytes_out",
        "(COALESCE(ra.acctinputoctets, 0) + COALESCE(ra.acctoutputoctets, 0)) AS total_bytes",
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
    const { username, ip, code, port } = req.body || {};

    if (!username || !ip || !code) {
      res.status(400).json({ success: false, message: "username, ip and code are required" });
    }

    await eventBus.publish({
      action: "disconnectAndCompleteSession",
      username,
      ip,
      code,
      port: typeof port === "number" ? port : undefined,
    });

    res.status(202).json({ success: true, message: "Disconnect scheduled" });
  } catch (error) {
    console.error("Error scheduling disconnect:", error);
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



