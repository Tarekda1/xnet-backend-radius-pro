import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const register = client.register;

// Default process/runtime metrics
client.collectDefaultMetrics({
  register,
});

// HTTP metrics
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Websocket clients gauge (set from server.ts)
const websocketClients = new client.Gauge({
  name: "websocket_clients",
  help: "Number of currently connected websocket clients",
  registers: [register],
});

export function setWebsocketClients(count: number) {
  websocketClients.set(count);
}

function getRouteLabel(req: Request): string {
  const routePath = (req as any).route?.path;
  const baseUrl = req.baseUrl || "";
  if (routePath) return `${baseUrl}${routePath}`;
  return "unmatched";
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationSeconds = Number(durationNs) / 1e9;
    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });
  next();
}

