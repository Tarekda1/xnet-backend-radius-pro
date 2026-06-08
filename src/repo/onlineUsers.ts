import { AppDataSource } from "../db/config";
import { Radacct } from "../db/entities/Radacct";
import {
  readOnlineSessionConfig,
  sqlRadacctIsActive,
  sqlRadacctIsOnline,
} from "../utils/onlineSessionPolicy";

export const getOnlineUsers = async () => {
  const { staleCutoff, activeCutoff } = readOnlineSessionConfig();
  const radacctRepo = AppDataSource.getRepository(Radacct);

  const totalOnlineUsers = await radacctRepo
    .createQueryBuilder("ra")
    .select("COUNT(DISTINCT ra.username)", "cnt")
    .where(sqlRadacctIsOnline("ra"))
    .setParameters({ staleCutoff, activeCutoff })
    .getRawOne<{ cnt: string }>();

  const totalActiveUsers = await radacctRepo
    .createQueryBuilder("ra")
    .select("COUNT(DISTINCT ra.username)", "cnt")
    .where(sqlRadacctIsActive("ra"))
    .setParameters({ staleCutoff, activeCutoff })
    .getRawOne<{ cnt: string }>();

  return {
    totalOnlineUsers: Number(totalOnlineUsers?.cnt ?? 0),
    totalActiveUsers: Number(totalActiveUsers?.cnt ?? 0),
  };
};
