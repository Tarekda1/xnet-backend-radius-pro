import { AppDataSource } from "../db/config";
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { SessionTracking } from "../db/entities/SessionTracking";

export const getOnlineUsers = async () => {

    // Consider a user "online" only if the session has a recent update.
    const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
    const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
    const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

    const sessionRepo = AppDataSource.getRepository(SessionTracking);
    const radUserProfileRepo = AppDataSource.getRepository(Raduserprofile);

     // 🔹 Count total users for pagination
     const totalOnlineUsers = await sessionRepo
     .createQueryBuilder("session")
     .where("session.status = :status", { status: "active" })
     // Use radacct as source of truth: must have an open accounting session with a recent update.
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