import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const jwtSecret = 'your_jwt_secret';

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).send('Token expired');
        return;
      }
      res.sendStatus(403);
      return;
    }
    req.user = user;
    next();
  });
};
