import helmet from 'helmet';
import cors from 'cors';
import statusMonitor from 'express-status-monitor';

export const securityMiddleware = (app: any) => {
    app.use(helmet());
    app.use(cors({
        origin: '*',
    }));
    app.use(statusMonitor());
};
