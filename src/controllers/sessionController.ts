import { Request, Response } from "express";
import { SessionTracking } from "../db/entities/SessionTracking";
import { Brackets, Repository } from "typeorm";
import { AppDataSource } from "../db/config";
import { Radusagestats } from "../db/entities/Radusagestats";
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { Radprofile } from "../db/entities/Radprofile";
import { UserDetails } from "../db/entities/UserDetails";
import { getOnlineUsers } from "../repo/onlineUsers";

export const healthCheck = (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
};

export const getOnlineUsersWithUsage = async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
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
    const totalUsers = await sessionRepo
      .createQueryBuilder("session")
      .where("session.status = :status", { status: "active" })
      .andWhere("session.startTime >= :today", { today })
      .getCount();

    // 🔹 Query online users with daily & monthly usage
    const users = await sessionRepo
      .createQueryBuilder("session")
      .leftJoinAndSelect(Radusagestats, "usage", "session.username = usage.username AND usage.day = :today", { today })
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
        "SUM(session.bytes_in) AS total_bytes_in",
        "SUM(session.bytes_out) AS total_bytes_out",
        "SUM(session.bytes_in + session.bytes_out) AS total_daily_usage",
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
      .andWhere("session.startTime >= :today", { today })
      .andWhere(new Brackets(qb => {
        qb.where("LOWER(session.username) LIKE :search", { search: `%${search}%` })
          .orWhere("LOWER(userDetails.fullName) LIKE :search", { search: `%${search}%` });
      }))
      .groupBy(`session.username, session.macAddress, session.status, 
        session.startTime, session.lastUpdate,
        session.sessionTime,usage.data_usage, monthlyUsage.monthly_usage, 
        profile.profileName, profile.dailyQuota, profile.monthlyQuota,userProfile.is_fallback`)
      .orderBy("session.startTime", "DESC") // Optional sorting
      .limit(limit)
      .offset(offset)
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

  const metrics = await getOnlineUsers();

  res.status(200).json({
    success: true,
    message: "Online users fetched successfully",
    data: metrics,
  });

};



