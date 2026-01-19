import { AppDataSource } from "../db/config";
import { SystemUsers } from "../db/entities/SystemUsers";
import { Role } from "../db/entities/Role";
import { RolePermission } from "../db/entities/RolePermission";
import { UserPermissionOverride } from "../db/entities/UserPermissionOverride";

export async function getEffectivePermissionsForUser(args: {
  userId?: number | null;
  username?: string | null;
  roleKey?: string | null;
}): Promise<string[]> {
  const roleKey = (args.roleKey || "").toString();
  const userId = typeof args.userId === "number" && Number.isFinite(args.userId) ? args.userId : null;

  const roleRepo = AppDataSource.getRepository(Role);
  const rolePermRepo = AppDataSource.getRepository(RolePermission);
  const userRepo = AppDataSource.getRepository(SystemUsers);
  const overrideRepo = AppDataSource.getRepository(UserPermissionOverride);

  // Resolve userId if missing (back-compat tokens)
  let resolvedUserId = userId;
  if (!resolvedUserId && args.username) {
    const u = await userRepo.findOne({ where: { username: args.username } });
    resolvedUserId = u?.id ?? null;
  }

  // Resolve roleId from roleKey
  const role = roleKey ? await roleRepo.findOne({ where: { key: roleKey } }) : null;
  const roleId = role?.id ?? null;

  const basePerms = new Set<string>();

  if (roleId) {
    const rows = await rolePermRepo.find({ where: { roleId } });
    for (const r of rows) basePerms.add(r.permission);
  }

  if (resolvedUserId) {
    const overrides = await overrideRepo.find({ where: { userId: resolvedUserId } });
    for (const o of overrides) {
      if (o.effect === "deny") basePerms.delete(o.permission);
      else basePerms.add(o.permission);
    }
  }

  return Array.from(basePerms);
}

