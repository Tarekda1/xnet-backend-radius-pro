import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("idx_connection_logs_timestamp_status", ["timestamp", "status"])
@Entity("connection_logs", { schema: "radius" })
export class ConnectionLogs {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id!: number;

  @Column("varchar", { name: "username", nullable: true, length: 50 })
  username!: string | null;

  @Column("varchar", { name: "mac_address", nullable: true, length: 20 })
  macAddress!: string | null;

  @Column("varchar", { name: "nas_ip", nullable: true, length: 15 })
  nasIp!: string | null;

  @Column("enum", {
    name: "status",
    nullable: true,
    enum: ["accepted", "rejected", "timeout", "error", "attempt"],
  })
  status!: "accepted" | "rejected" | "timeout" | "error" | "attempt" | null;

  @Column("enum", {
    name: "acct_status",
    nullable: true,
    enum: ["start", "stop", "update"],
  })
  acctStatus!: "start" | "stop" | "update" | null;

  @Column("enum", {
    name: "terminate_cause",
    nullable: true,
    enum: ["user-request", "idle-timeout", "session-timeout", "lost-carrier"],
  })
  terminateCause!:
    | "user-request"
    | "idle-timeout"
    | "session-timeout"
    | "lost-carrier"
    | null;

  @Column("datetime", {
    name: "timestamp",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  timestamp!: Date | null;
}
