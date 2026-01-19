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

    // 🔹 Count total users for pagination
    const totalQb = sessionRepo
      .createQueryBuilder("session")
      .leftJoin(Raduserprofile, "userProfile", "session.username = userProfile.username")
      // Join user_details ONLY for filtering; do not select/map it (avoids ONLY_FULL_GROUP_BY issues)
      .leftJoin(UserDetails, "userDetails", "session.username = userDetails.username")
      .select("COUNT(DISTINCT session.username)", "cnt")
      .where("session.status = :status", { status: "active" });

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
        session.sessionTime,usage.data_usage, monthlyUsage.monthly_usage, dailyUsage.daily_usage,
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



