import { AppDataSource } from "../db/config";
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { SessionTracking } from "../db/entities/SessionTracking";

export const getOnlineUsers = async () => {

    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    // const firstDayOfMonth = new Date(today);
    // firstDayOfMonth.setDate(1); // Get the first day of the month
    // const firstDayOfMonthStr = firstDayOfMonth.toISOString().split("T")[0];

    const sessionRepo = AppDataSource.getRepository(SessionTracking);
    const radUserProfileRepo = AppDataSource.getRepository(Raduserprofile);

     // 🔹 Count total users for pagination
     const totalOnlineUsers = await sessionRepo
     .createQueryBuilder("session")
     .where("session.status = :status", { status: "active" })
     .andWhere("session.startTime >= :today", { today })
     .getCount();

     const totalActiveUsers = await radUserProfileRepo
     .createQueryBuilder("userprofile")
     .where("userprofile.accountStatus = :status", { status: "active" })
     .getCount();


     return {
        totalOnlineUsers: totalOnlineUsers, // 🔹 Total users for pag
        totalActiveUsers: totalActiveUsers,
     }
}