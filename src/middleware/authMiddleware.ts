import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/config';
import { SystemUsers } from '../db/entities/SystemUsers';

const jwtSecret = 'your_jwt_secret';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  try {
    const decoded: any = jwt.verify(token, jwtSecret);
    let role = decoded?.role as SystemUsers['role'] | undefined;

    // Backward compatibility: older tokens may not have role. Fetch from DB.
    if (!role && decoded?.username) {
      try {
        const userRepo = AppDataSource.getRepository(SystemUsers);
        const dbUser = await userRepo.findOne({ where: { username: decoded.username } });
        role = dbUser?.role ?? undefined;
      } catch (e) {
        // ignore DB errors here; will fall back to undefined role
      }
    }

    req.user = { username: decoded?.username, role } as any;
    next();
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      res.status(401).send('Token expired');
      return;
    }
    res.sendStatus(403);
  }
};

export const authorizeRoles = (...allowedRoles: Array<'admin' | 'manager' | 'support' | 'collector'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403).send('Forbidden');
      return;
    }
    next();
  };
};