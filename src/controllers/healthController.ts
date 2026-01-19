import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../db/config';
import { redisClient } from '../redisClient';
import { isShuttingDown } from '../state/shutdown';

export const healthCheck = (req: Request, res: Response) => {
    res.status(200).json({ status: 'UP' });
};

export const readyCheck = async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    if (isShuttingDown()) {
        res.status(503).json({ status: 'DOWN', reason: 'shutting_down' });
        return;
    }

    const checks: Record<string, any> = {
        db: { ok: false },
        redis: { ok: false },
    };

    // DB readiness
    checks.db.ok = AppDataSource.isInitialized === true;

    // Redis readiness
    try {
        const isOpen = (redisClient as any).isOpen === true;
        if (isOpen) {
            await redisClient.ping();
            checks.redis.ok = true;
        } else {
            checks.redis.ok = false;
            checks.redis.reason = 'not_connected';
        }
    } catch (e: any) {
        checks.redis.ok = false;
        checks.redis.reason = e?.message || 'ping_failed';
    }

    const ok = Boolean(checks.db.ok && checks.redis.ok);
    res.status(ok ? 200 : 503).json({ status: ok ? 'UP' : 'DOWN', checks });
};
