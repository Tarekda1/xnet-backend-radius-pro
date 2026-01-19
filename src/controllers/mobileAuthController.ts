import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { Equal } from "typeorm";
import { AppDataSource } from "../db/config";
import { SystemUsers } from "../db/entities/SystemUsers";
import { RefreshTokens } from "../db/entities/RefreshTokens";
import { getEffectivePermissionsForUser } from "../access/permissionService";

const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "your_refresh_jwt_secret";

type MobileUser = {
  id: number;
  username: string;
  role: SystemUsers["role"];
  permissions: string[];
};

const toMobileUser = async (user: SystemUsers): Promise<MobileUser> => {
  const permissions = await getEffectivePermissionsForUser({
    userId: user.id,
    username: user.username,
    roleKey: user.role ?? undefined,
  });

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions,
  };
};

/**
 * POST /api/auth/mobile/login
 * Body: { username, password }
 * Returns: { accessToken, refreshToken, user: { id, username, role } }
 */
export const mobileLogin: RequestHandler = async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ message: "username and password are required" });
    return;
  }

  const userRepository = AppDataSource.getRepository(SystemUsers);
  const refreshTokenRepository = AppDataSource.getRepository(RefreshTokens);

  try {
    const lookup = username.trim().toLowerCase();
    const user = await userRepository.findOne({ where: { username: Equal(lookup) } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: "1d" }
    );
    const refreshToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      refreshTokenSecret
    );

    const newRefreshToken = refreshTokenRepository.create({ token: refreshToken, user });
    await refreshTokenRepository.save(newRefreshToken);

    res.status(200).json({
      accessToken,
      refreshToken,
      user: await toMobileUser(user),
    });
    return;
  } catch (e) {
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

/**
 * POST /api/auth/mobile/refresh
 * Body: { refreshToken } (or { token } for compatibility)
 * Returns: { accessToken }
 */
export const mobileRefresh: RequestHandler = async (req, res) => {
  const refreshToken = (req.body?.refreshToken ?? req.body?.token) as unknown;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    res.status(401).json({ message: "refreshToken is required" });
    return;
  }

  const refreshTokenRepository = AppDataSource.getRepository(RefreshTokens);

  try {
    const storedToken = await refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ["user"],
    });

    if (!storedToken) {
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }
    if (storedToken.revokedAt) {
      res.status(403).json({ message: "Refresh token has been revoked" });
      return;
    }

    try {
      jwt.verify(refreshToken, refreshTokenSecret);
    } catch (err: any) {
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }

    const username = storedToken.user?.username;
    const role = storedToken.user?.role;
    const id = storedToken.user?.id;
    if (!username) {
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }

    const accessToken = jwt.sign({ id, username, role }, jwtSecret, { expiresIn: "15m" });
    res.status(200).json({ accessToken });
    return;
  } catch (e) {
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

/**
 * POST /api/auth/mobile/logout
 * Body: { refreshToken } (or { token } for compatibility)
 * Revokes (does not delete) the refresh token.
 */
export const mobileLogout: RequestHandler = async (req, res) => {
  const refreshToken = (req.body?.refreshToken ?? req.body?.token) as unknown;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    res.status(400).json({ message: "refreshToken is required" });
    return;
  }

  const refreshTokenRepository = AppDataSource.getRepository(RefreshTokens);

  try {
    const storedToken = await refreshTokenRepository.findOne({ where: { token: refreshToken } });
    if (storedToken && !storedToken.revokedAt) {
      storedToken.revokedAt = new Date();
      await refreshTokenRepository.save(storedToken);
    }
    // Always return 204 to avoid leaking token validity
    res.status(204).send();
    return;
  } catch (e) {
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

