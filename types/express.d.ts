// types/express.d.ts
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    user?: {
      id?: number;
      username: string;
      role?: 'admin' | 'manager' | 'support' | 'collector' | 'reseller';
      resellerId?: number | null;
      permissions?: string[];
      // add any other properties as needed
    };
  }
}
