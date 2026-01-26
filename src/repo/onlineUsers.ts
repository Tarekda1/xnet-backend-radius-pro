import { AppDataSource } from "../db/config";
import { Raduserprofile } from "../db/entities/Raduserprofile";
import { Radacct } from "../db/entities/Radacct";

export const getOnlineUsers = async () => {

    // Consider a user "online" only if the session has a recent update.
    const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
    const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
    const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

    const radacctRepo = AppDataSource.getRepository(Radacct);
    const radUserProfileRepo = AppDataSource.getRepository(Raduserprofile);

     // Source of truth: open + fresh accounting sessions
     const totalOnlineUsers = await radacctRepo
     .createQueryBuilder("ra")
     .select("COUNT(DISTINCT ra.username)", "cnt")
     .where("ra.acctstoptime IS NULL")
     .andWhere("COALESCE(ra.acctupdatetime, ra.acctstarttime) >= :staleCutoff", { staleCutoff })
     .getRawOne<{ cnt: string }>();

     const totalActiveUsers = await radUserProfileRepo
     .createQueryBuilder("userprofile")
     .where("userprofile.accountStatus = :status", { status: "active" })
     .getCount();


     return {
        totalOnlineUsers: Number(totalOnlineUsers?.cnt ?? 0),
        totalActiveUsers: totalActiveUsers,
     }
}