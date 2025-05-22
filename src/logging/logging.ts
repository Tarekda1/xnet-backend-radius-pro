// src/logger/index.ts
import winston from 'winston';
import expressWinston from 'express-winston';
import { Request, Response, NextFunction } from 'express';
import { getRepository } from 'typeorm';
import { Logs } from '../db/entities/Logs'; // Adjust the path as needed
import { TypeOrmTransport } from './TypeormTransport';
import { AppDataSource } from '../db/config';

class Logger {
  private static instance: winston.Logger;


  // Private constructor to enforce singleton
  private constructor() {}

  public static getInstance(params?: { level?: string; format?: winston.Logform.Format }): winston.Logger {
    if (!Logger.instance) {
      // Retrieve the repository here once the connection is established
      const logRepository = AppDataSource.getRepository(Logs);
      const typeOrmTransport = new TypeOrmTransport({ repository: logRepository });

      Logger.instance = winston.createLogger({
        level: params?.level || 'info',
        format: params?.format || winston.format.combine(
          winston.format.colorize(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ filename: 'combined.log' }),
          typeOrmTransport
        ]
      });
    }
    return Logger.instance;
  }
}

// Middleware to log all requests using the singleton logger instance
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const log = Logger.getInstance();
  log.info(`Incoming request: ${req.method} ${req.url}`);
  next();
}

// Express-Winston middleware (using our custom TypeOrmTransport)
export const loggerMiddleware = expressWinston.logger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' }),
    // Create a new transport instance using the repository. Note: Ensure your connection is active.
    new TypeOrmTransport({ repository:   AppDataSource.getRepository(Logs) })
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
});

export { Logger };
