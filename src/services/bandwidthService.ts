// Try to load node-routeros at runtime. If it fails (e.g. missing in container) we stay in mock mode.
let RouterOSAPI: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RouterOSAPI = require('node-routeros').RouterOSAPI;
} catch (err) {
  // Module not present – will run in mock mode
}

import { Logger } from '../logging/logging';

const logger = Logger.getInstance();

export interface BandwidthData {
  interface: string;
  rxByte: number;
  txByte: number;
  rxPacket: number;
  txPacket: number;
  rxRate: number;
  txRate: number;
  timestamp: Date;
}

export interface BandwidthSummary {
  totalRxBytes: number;
  totalTxBytes: number;
  totalRxRate: number;
  totalTxRate: number;
  interfaces: BandwidthData[];
  timestamp: Date;
}

export class BandwidthService {
  private routerIP: string;
  private username: string;
  private password: string;
  private apiPort: number;
  private conn: any; // RouterOSAPI instance or null in mock mode
  private readonly mockMode: boolean;

  constructor() {
    this.routerIP = process.env.MIKROTIK_IP || '172.8.16.2';
    this.username = process.env.MIKROTIK_USERNAME || 'apiuser';
    this.password = process.env.MIKROTIK_PASSWORD || '123456';
    this.apiPort = parseInt(process.env.MIKROTIK_API_PORT || '8728');

    this.mockMode = !RouterOSAPI;

    if (this.mockMode) {
      this.conn = null;
      logger.warn('BandwidthService running in MOCK MODE – node-routeros module not available');
    } else {
      this.conn = new RouterOSAPI({
        host: this.routerIP,
        user: this.username,
        password: this.password,
        port: this.apiPort,
        timeout: 10000
      });
      logger.info('BandwidthService initialised in REAL MODE – MikroTik integration enabled');

      // --------------------------------------------------------------------
      // Attach low-level error & timeout handlers
      // --------------------------------------------------------------------
      // The node-routeros connector emits an "error" event (and sometimes a
      // RosException) when the underlying socket times out or encounters
      // another fatal issue.  If no listener is registered, Node treats it as
      // an unhandled exception and the whole process crashes.  By attaching a
      // defensive listener we make sure the error is logged and let the
      // higher-level promise rejection flow handle it gracefully.
      this.conn.on('error', (err: any) => {
        // Log and swallow – callers will also receive a rejected promise.
        logger.error('RouterOSAPI emitted an error event:', err?.message || err);

        // Ensure we are in a clean state – close the connection so the next
        // operation can trigger a fresh reconnect via ensureConnection().
        if (this.conn.connected) {
          this.conn.close();
        }
      });

      // "timeout" events are not always re-emitted as errors by the library
      // but can still crash the process if unhandled.
      this.conn.on('timeout', () => {
        logger.warn('RouterOSAPI connection timed out');
      });
    }
  }

  /* ------------------------------------------------------------------
   * Connection handling (real mode only)
   * ------------------------------------------------------------------*/
  private async ensureConnection(): Promise<void> {
    if (this.mockMode) return; // nothing to do

    try {
      if (!this.conn.connected) {
        logger.debug(`Connecting to MikroTik ${this.routerIP}:${this.apiPort}`);
        await this.conn.connect();
        logger.info('Connected to MikroTik');
      }
    } catch (error: any) {
      logger.error('Failed to connect to MikroTik:', error.message || error);
      throw new Error('MikroTik connection failed');
    }
  }

  /* ------------------------------------------------------------------
   * Interface traffic
   * ------------------------------------------------------------------*/
  async getInterfaceTraffic(): Promise<BandwidthData[]> {
    if (this.mockMode) return this.generateMockInterfaceTraffic();

    await this.ensureConnection();

    const interfaces = await this.conn.write('/interface/print');
    const data: BandwidthData[] = [];

    for (const iface of interfaces) {
      if (iface.type === 'ether' || iface.type === 'wlan' || iface.type === 'bridge') {
        // RouterOS returns live traffic with /interface/monitor-traffic once=yes
        const stats = await this.conn.write('/interface/monitor-traffic', [
          `=interface=${iface.name}`,
          '=once=yes'
        ]).catch(() => []);
        if (stats.length) {
          const s = stats[0];
          const rxBits = parseInt(s['rx-bits-per-second'] || s['rx-bps'] || '0');
          const txBits = parseInt(s['tx-bits-per-second'] || s['tx-bps'] || '0');
          data.push({
            interface: iface.name,
            rxByte: parseInt(s['rx-byte'] || s['rx-bytes'] || '0'),
            txByte: parseInt(s['tx-byte'] || s['tx-bytes'] || '0'),
            rxPacket: parseInt(s['rx-packet'] || s['rx-packets'] || '0'),
            txPacket: parseInt(s['tx-packet'] || s['tx-packets'] || '0'),
            rxRate: rxBits / 8, // convert bits/sec -> bytes/sec
            txRate: txBits / 8,
            timestamp: new Date()
          });
        }
      }
    }
    return data;
  }

  /* ------------------------------------------------------------------
   * System resources
   * ------------------------------------------------------------------*/
  async getSystemResources(): Promise<any> {
    if (this.mockMode) return this.generateMockSystemResources();

    await this.ensureConnection();
    const res = await this.conn.write('/system/resource/print');
    if (!res.length) throw new Error('No system resource data');
    const r = res[0];
    return {
      cpuLoad: r['cpu-load'] || '0%',
      freeMemory: r['free-memory'] || '0',
      totalMemory: r['total-memory'] || '0',
      freeHddSpace: r['free-hdd-space'] || '0',
      totalHddSpace: r['total-hdd-space'] || '0',
      uptime: r.uptime || '0s',
      version: r.version || 'Unknown',
      platform: r.platform || 'Unknown',
      boardName: r['board-name'] || 'Unknown',
      architecture: r['architecture-name'] || 'Unknown',
      timestamp: new Date()
    };
  }

  /* ------------------------------------------------------------------
   * Active connections (PPP + DHCP)
   * ------------------------------------------------------------------*/
  async getActiveConnections(): Promise<any> {
    if (this.mockMode) return this.generateMockActiveConnections();

    await this.ensureConnection();
    const pppActive = await this.conn.write('/ppp/active/print').catch(() => []);
    const dhcpLeases = await this.conn.write('/ip/dhcp-server/lease/print', [
      '?status=bound'
    ]).catch(() => []);
    return {
      pppConnections: pppActive,
      dhcpConnections: dhcpLeases,
      totalActiveConnections: pppActive.length + dhcpLeases.length
    };
  }

  /* ------------------------------------------------------------------
   * User traffic
   * ------------------------------------------------------------------*/
  async getUserTraffic(username: string): Promise<any> {
    if (this.mockMode) return this.generateMockUserTraffic(username);

    await this.ensureConnection();
    const pppActive = await this.conn.write('/ppp/active/print', [`?name=${username}`]).catch(() => []);
    if (pppActive.length) {
      const u = pppActive[0];
      return {
        username,
        isOnline: true,
        connectionType: 'ppp',
        address: u.address,
        uptime: u.uptime,
        bytesIn: u['bytes-in'] || 0,
        bytesOut: u['bytes-out'] || 0,
        timestamp: new Date()
      };
    }
    return { username, isOnline: false };
  }

  /* ------------------------------------------------------------------
   *Helpers: MOCK generators
   * ------------------------------------------------------------------*/
  private generateMockInterfaceTraffic(): BandwidthData[] {
    logger.debug('Generating mock interface stats');
    return [...this.generateMockEth('ether1'), ...this.generateMockEth('ether2'), ...this.generateMockEth('wlan1')];
  }

  private generateMockEth(name: string): BandwidthData[] {
    return [{
      interface: name,
      rxByte: Math.floor(Math.random() * 4_000_000) + 500_000,
      txByte: Math.floor(Math.random() * 2_000_000) + 300_000,
      rxPacket: Math.floor(Math.random() * 4_000) + 800,
      txPacket: Math.floor(Math.random() * 2_500) + 400,
      rxRate: Math.floor(Math.random() * 1500) + 300,
      txRate: Math.floor(Math.random() * 800) + 150,
      timestamp: new Date()
    }];
  }

  private generateMockSystemResources() {
    return {
      cpuLoad: `${Math.floor(Math.random() * 30) + 5}%`,
      freeMemory: `${Math.floor(Math.random() * 200) + 400}MB`,
      totalMemory: '1024MB',
      freeHddSpace: `${Math.floor(Math.random() * 5) + 85}GB`,
      totalHddSpace: '128GB',
      uptime: `${Math.floor(Math.random() * 30) + 1}d ${Math.floor(Math.random() * 24)}h`,
      version: '6.49.10 (mock)',
      platform: 'MikroTik (mock)',
      boardName: 'RB1100AHx4 (mock)',
      architecture: 'arm (mock)',
      timestamp: new Date()
    };
  }

  private generateMockActiveConnections() {
    const names = ['alice', 'bob', 'charlie', 'dave', 'eve'];
    const ppp = names.slice(0, Math.floor(Math.random() * names.length) + 1).map((n, i) => ({
      name: n,
      address: `10.0.0.${10 + i}`,
      uptime: `${Math.floor(Math.random() * 4) + 1}h`,
      'bytes-in': Math.floor(Math.random() * 50_000_000),
      'bytes-out': Math.floor(Math.random() * 25_000_000)
    }));
    const dhcp = Array.from({ length: Math.floor(Math.random() * 4) + 2 }, (_, i) => ({
      address: `192.168.1.${100 + i}`,
      'mac-address': `00:11:22:33:44:${(50 + i).toString(16).padStart(2, '0')}`
    }));
    return { pppConnections: ppp, dhcpConnections: dhcp, totalActiveConnections: ppp.length + dhcp.length };
  }

  private generateMockUserTraffic(username: string) {
    const online = Math.random() > 0.3;
    return {
      username,
      isOnline: online,
      connectionType: online ? 'ppp' : null,
      address: online ? `10.0.0.${Math.floor(Math.random() * 50)}` : null,
      uptime: online ? `${Math.floor(Math.random() * 5)}h` : null,
      bytesIn: online ? Math.floor(Math.random() * 50_000_000) : 0,
      bytesOut: online ? Math.floor(Math.random() * 20_000_000) : 0,
      timestamp: new Date()
    };
  }

  async disconnect(): Promise<void> {
    if (!this.mockMode && this.conn?.connected) {
      await this.conn.close();
    }
  }

  async cleanup(): Promise<void> {
    await this.disconnect();
  }

  /* ------------------------------------------------------------------
   * Bandwidth summary
   * ------------------------------------------------------------------*/
  async getBandwidthSummary(): Promise<BandwidthSummary> {
    const interfaces = await this.getInterfaceTraffic();

    const summary: BandwidthSummary = {
      totalRxBytes: 0,
      totalTxBytes: 0,
      totalRxRate: 0,
      totalTxRate: 0,
      interfaces,
      timestamp: new Date()
    };

    interfaces.forEach((iface) => {
      summary.totalRxBytes += iface.rxByte;
      summary.totalTxBytes += iface.txByte;
      summary.totalRxRate += iface.rxRate;
      summary.totalTxRate += iface.txRate;
    });

    return summary;
  }

  /* ------------------------------------------------------------------
   * Historical traffic (simple: current snapshot)
   * ------------------------------------------------------------------*/
  async getHistoricalTraffic(interfaceName: string, duration: number = 3600): Promise<BandwidthData[]> {
    // In a real implementation we would query stored historical data.
    // For now we just return the current snapshot for the requested interface.
    const interfaces = await this.getInterfaceTraffic();
    return interfaces.filter((i) => i.interface === interfaceName);
  }

  /* ------------------------------------------------------------------
   * Simple connectivity test
   * ------------------------------------------------------------------*/
  async testConnection(): Promise<boolean> {
    if (this.mockMode) return true;
    try {
      await this.ensureConnection();
      // A lightweight command just to verify auth & connectivity
      await this.conn.write('/system/identity/print');
      return true;
    } catch (err) {
      logger.warn('MikroTik testConnection failed:', err);
      return false;
    }
  }
}

export const bandwidthService = new BandwidthService(); 