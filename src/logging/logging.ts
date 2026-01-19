// src/logger/index.ts
import winston from 'winston';
import expressWinston from 'express-winston';
import { Request, Response, NextFunction } from 'express';
import { getRepository } from 'typeorm';
import { Logs } from '../db/entities/Logs'; // Adjust the path as needed
import { TypeOrmTransport } from './TypeormTransport';
import { AppDataSource } from '../db/config';

function isJsonLoggingEnabled() {
  const v = String(process.env.LOG_FORMAT || "").toLowerCase();
  if (v === "json") return true;
  // default to JSON logs in production so Loki parsing is clean
  return process.env.NODE_ENV === "production";
}

function baseFormat() {
  if (isJsonLoggingEnabled()) {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
  }

  return winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const msg = info.message ?? "";
      return `${info.timestamp} ${info.level}: ${msg}`;
    })
  );
}

class Logger {
  private static instance: winston.Logger;

  private static createLogger(params?: { level?: string; format?: winston.Logform.Format }): winston.Logger {
    const baseTransports: winston.transport[] = [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'combined.log' })
    ];

    // Only add TypeORM transport if DataSource is initialized
    if (AppDataSource.isInitialized) {
      try {
        const logRepository = AppDataSource.getRepository(Logs);
        baseTransports.push(new TypeOrmTransport({ repository: logRepository }));
      } catch (err) {
        console.warn('🟡 Logger: Unable to attach TypeORM transport (repository not available yet). Falling back to file/console.', err);
      }
    } else {
      console.warn('🟡 Logger: AppDataSource not initialized. Using file/console transports only.');
    }

    return winston.createLogger({
      level: params?.level || 'info',
      format: params?.format || baseFormat(),
      transports: baseTransports
    });
  }

  // Private constructor to enforce singleton
  private constructor() {}

  public static getInstance(params?: { level?: string; format?: winston.Logform.Format }): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = Logger.createLogger(params);
    } else if (AppDataSource.isInitialized && !(Logger.instance.transports.some(t => t instanceof TypeOrmTransport))) {
      // Add DB transport dynamically once DataSource is ready
      try {
        const logRepository = AppDataSource.getRepository(Logs);
        Logger.instance.add(new TypeOrmTransport({ repository: logRepository }));
        console.log('✅ Logger: TypeORM transport attached after DataSource initialization');
      } catch (err) {
        console.warn('🟡 Logger: Failed to add TypeORM transport post-initialization', err);
      }
    }
    return Logger.instance;
  }
}

// Middleware to log all requests using the singleton logger instance
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const log = Logger.getInstance();
  log.info('Incoming request', {
    requestId: (req as any).requestId,
    method: req.method,
    url: req.url,
  });
  next();
}

// Express-Winston middleware (using our custom TypeOrmTransport)
export const loggerMiddleware = expressWinston.logger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' })
    // DB transport will be added dynamically once DataSource is ready
  ],
  format: baseFormat(),
  dynamicMeta: (req) => ({
    requestId: (req as any).requestId,
  }),
  // keep express-winston message consistent
  msg: "HTTP {{req.method}} {{req.url}}",
});

export { Logger };
