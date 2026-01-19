import { Request, Response } from "express";
import { In } from "typeorm";

import { PERMISSIONS } from "../access/permissions";
import { AppDataSource } from "../db/config";
import { Role } from "../db/entities/Role";
import { RolePermission } from "../db/entities/RolePermission";
import { SystemUsers } from "../db/entities/SystemUsers";
import { UserPermissionOverride, type PermissionEffect } from "../db/entities/UserPermissionOverride";

const sendResponse = (res: Response, success: boolean, status: number, message: string, data: any = null) => {
  res.status(status).json({ success, message, data });
};

function isValidPermission(p: unknown): p is string {
  return typeof p === "string" && (PERMISSIONS as readonly string[]).includes(p);
}

function isValidEffect(e: unknown): e is PermissionEffect {
  return e === "allow" || e === "deny";
}

export async function listPermissions(req: Request, res: Response) {
  sendResponse(res, true, 200, "Permissions fetched", { permissions: PERMISSIONS });
}

export async function searchUsers(req: Request, res: Response) {
  const search = String(req.query.search ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 20) || 20));

  const qb = AppDataSource.getRepository(SystemUsers).createQueryBuilder("u").select([
    "u.id",
    "u.username",
    "u.email",
    "u.role",
  ]);

  if (search) {
    const q = `%${search.toLowerCase()}%`;
    qb.where("LOWER(u.username) LIKE :q OR LOWER(u.email) LIKE :q", { q });
  }

  const users = await qb.orderBy("u.username", "ASC").limit(limit).getMany();
  sendResponse(res, true, 200, "Users fetched", {
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
    })),
  });
}

export async function listRoles(req: Request, res: Response) {
  const roleRepo = AppDataSource.getRepository(Role);
  const rolePermRepo = AppDataSource.getRepository(RolePermission);

  const roles = await roleRepo.find({ order: { id: "ASC" } });
  const roleIds = roles.map((r) => r.id);
  const perms = roleIds.length ? await rolePermRepo.find({ where: { roleId: In(roleIds) } }) : [];

  const permsByRoleId = new Map<number, string[]>();
  for (const p of perms) {
    const arr = permsByRoleId.get(p.roleId) ?? [];
    arr.push(p.permission);
    permsByRoleId.set(p.roleId, arr);
  }

  const data = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    permissions: (permsByRoleId.get(r.id) ?? []).sort(),
  }));

  sendResponse(res, true, 200, "Roles fetched", { roles: data });
}

export async function replaceRolePermissions(req: Request, res: Response) {
  const roleKey = String(req.params.roleKey || "").trim();
  const bodyPerms = (req.body?.permissions ?? req.body?.data?.permissions) as unknown;

  if (!roleKey) return sendResponse(res, false, 400, "roleKey is required");
  if (!Array.isArray(bodyPerms)) return sendResponse(res, false, 400, "permissions must be an array");

  const permissions = Array.from(new Set(bodyPerms)).filter(isValidPermission);
  if (permissions.length !== bodyPerms.length) {
    return sendResponse(res, false, 400, "permissions contains invalid entries");
  }

  const roleRepo = AppDataSource.getRepository(Role);
  const rolePermRepo = AppDataSource.getRepository(RolePermission);

  const role = await roleRepo.findOne({ where: { key: roleKey } });
  if (!role) return sendResponse(res, false, 404, "Role not found");

  await AppDataSource.transaction(async (trx) => {
    await trx.getRepository(RolePermission).delete({ roleId: role.id });
    if (permissions.length) {
      await trx.getRepository(RolePermission).insert(
        permissions.map((p) => ({
          roleId: role.id,
          permission: p,
        }))
      );
    }
  });

  const updated = await rolePermRepo.find({ where: { roleId: role.id } });
  sendResponse(res, true, 200, "Role permissions updated", { roleKey, permissions: updated.map((p) => p.permission).sort() });
}

export async function getUserOverrides(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) return sendResponse(res, false, 400, "Invalid userId");

  const repo = AppDataSource.getRepository(UserPermissionOverride);
  const rows = await repo.find({ where: { userId } });
  sendResponse(res, true, 200, "User overrides fetched", {
    userId,
    overrides: rows.map((r) => ({ permission: r.permission, effect: r.effect })),
  });
}

export async function replaceUserOverrides(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) return sendResponse(res, false, 400, "Invalid userId");

  const bodyOverrides = (req.body?.overrides ?? req.body?.data?.overrides) as unknown;
  if (!Array.isArray(bodyOverrides)) return sendResponse(res, false, 400, "overrides must be an array");

  const overrides = bodyOverrides.map((o: any) => ({
    permission: o?.permission,
    effect: o?.effect,
  }));

  if (!overrides.every((o) => isValidPermission(o.permission) && isValidEffect(o.effect))) {
    return sendResponse(res, false, 400, "overrides contains invalid entries");
  }

  // Ensure unique per permission (last write wins in request payload)
  const map = new Map<string, PermissionEffect>();
  for (const o of overrides) map.set(o.permission, o.effect);

  await AppDataSource.transaction(async (trx) => {
    await trx.getRepository(UserPermissionOverride).delete({ userId });
    const rows = Array.from(map.entries()).map(([permission, effect]) => ({ userId, permission, effect }));
    if (rows.length) {
      await trx.getRepository(UserPermissionOverride).insert(rows);
    }
  });

  sendResponse(res, true, 200, "User overrides updated", {
    userId,
    overrides: Array.from(map.entries()).map(([permission, effect]) => ({ permission, effect })),
  });
}

