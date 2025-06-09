import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("idx_username", ["username"], {})
@Index("idx_timestamp", ["timestamp"], {})
@Entity("quota_logs", { schema: "radius" })
export class QuotaLogs {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("varchar", { name: "username", length: 64 })
  username: string;

  @Column("varchar", { name: "event_type", length: 20 })
  eventType: string;

  @Column("varchar", { name: "quota_type", length: 10 })
  quotaType: string;

  @Column("datetime", { name: "timestamp" })
  timestamp: Date;
}
