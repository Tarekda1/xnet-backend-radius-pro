// src/logger/TypeOrmTransport.ts
import Transport from 'winston-transport';
import { Repository } from 'typeorm';
import { Logs } from '../db/entities/Logs';

interface TypeOrmTransportOptions extends Transport.TransportStreamOptions {
  repository: Repository<Logs>;
}

export class TypeOrmTransport extends Transport {
  private repository: Repository<Logs>;

  constructor(opts: TypeOrmTransportOptions) {
    super(opts);
    this.repository = opts.repository;
  }

  log(info: any, callback: () => void) {
    // Ensure the log is processed asynchronously
    setImmediate(() => this.emit('logged', info));

    // Create a new log entry from the info object
    const logEntry = this.repository.create({
      level: info.level,
      message: info.message,
      meta: info.meta || {},
      timestamp: new Date()
    });

    // Save the log entry to the database
    this.repository.save(logEntry)
      .then(() => callback())
      .catch(err => {
        console.error('Error saving log entry:', err);
        callback();
      });
  }
}
