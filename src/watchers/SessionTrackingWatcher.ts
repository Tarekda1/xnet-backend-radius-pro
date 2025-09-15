// src/watchers/SessionTrackingWatcher.ts
import { getOnlineUsers } from '../repo/onlineUsers'; // adjust as needed
import { Server as SocketIOServer } from 'socket.io';

export class SessionTrackingWatcher {
  private lastCheck: Date;
  public started = false;

  constructor(private ws: any, private intervalMs: number = 10000) {
    this.lastCheck = new Date();
  }

  start() {
    if (this.started) return;

    this.started = true;
    setInterval(async () => {

      const userMetrics = await getOnlineUsers();
      //console.log('📤 Emitting metrics:', userMetrics);
      this.ws.send(JSON.stringify(userMetrics)); // ✅ emit to all connected clients

    }, this.intervalMs);
  }
}
