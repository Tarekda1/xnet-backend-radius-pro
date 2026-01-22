## User Flow Logs (MikroTik PPPoE) → ClickHouse → Grafana

This adds per-user destination traffic logging using MikroTik **Traffic-Flow (NetFlow v9/IPFIX)**.

### What you get
- A UDP **flow ingestor** (`flow-ingestor`) listening on **UDP 2055**
- It decodes MikroTik Traffic-Flow records, maps **src IP → PPPoE username** using `session_tracking.framed_ip`
- Writes to **ClickHouse** table `flow_logs.user_flow_logs`
- Grafana datasource **ClickHouse (Flow Logs)** + a starter dashboard **User Flow Logs**

---

## 1) Start the stack

From `xnet-backend-radius-pro`:

1. Ensure Docker is running
2. Start services:

```bash
docker compose up -d --build
```

Grafana: `http://localhost:3001` (admin/admin by default unless overridden).

---

## 2) MikroTik RouterOS v7 config (PPPoE behind NAT)

### NetFlow v9 (simpler)

```routeros
/ip traffic-flow set enabled=yes interfaces=all cache-entries=64k active-flow-timeout=1m inactive-flow-timeout=15s
/ip traffic-flow target add dst-address=<YOUR_FLOW_INGESTOR_LAN_IP> port=2055 version=9
```

Notes:
- Use the **LAN IP** of the machine running Docker (reachable from MikroTik).
- If you want more “real-time” updates, reduce `active-flow-timeout`.

### IPFIX NAT events (optional)
Only needed if your exporter is sending post-NAT addresses and you need NAT mapping.

```routeros
/ip traffic-flow ipfix set nat-events=yes
```

---

## 3) Data model

ClickHouse table: `flow_logs.user_flow_logs`

Columns:
- `ts` (insert time)
- `username`
- `src_ip`, `dst_ip`, `dst_port`, `proto`
- `bytes`, `packets`
- `router_id`, `session_id`

TTL: 30 days (auto deletion).

---

## 4) How username mapping works

The ingestor resolves the PPPoE username by looking up the most recent active session:

- `session_tracking.framed_ip == flow.src_ip`
- `session_tracking.status = 'active'`

If no match is found, the flow is skipped (counter `skipped`).

---

## 5) Grafana

- Datasource: **ClickHouse (Flow Logs)**
- Dashboard folder: **Flow Logs**
- Dashboard: **User Flow Logs**

Starter query shows “Top destinations by bytes” in the selected time range.

