// types/express.d.ts
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      username: string;
      role?: 'admin' | 'manager' | 'support' | 'collector';
      // add any other properties as needed
    };
  }
}
