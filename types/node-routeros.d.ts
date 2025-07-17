// src/types/node-routeros.d.ts
declare module 'node-routeros' {
  export interface RouterOSAPIConfig {
    host: string;
    user: string;
    password: string;
    port?: number;
    timeout?: number;
    keepalive?: boolean;
  }

  export class RouterOSAPI {
    constructor(config: RouterOSAPIConfig);
    
    connected: boolean;
    
    connect(): Promise<void>;
    close(): Promise<void>;
    write(path: string, params?: string[]): Promise<any[]>;
    
    // Additional methods that might be available
    menu(path: string): any;
    stream(path: string, callback?: (err: any, data: any, raw?: any) => void): any;
  }
}
