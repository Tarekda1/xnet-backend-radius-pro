import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // Log full error server-side, but return a safe response
    console.error(err?.stack || err);
    res.status(500).json({
      message: 'Internal Server Error',
      requestId: (req as any).requestId,
    });
};
