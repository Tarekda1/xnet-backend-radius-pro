import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("detailed_usage", { schema: "radius" })
export class DetailedUsage {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("varchar", { name: "username", nullable: true, length: 64 })
  username: string | null;

  @Column("varchar", { name: "mac_address", nullable: true, length: 17 })
  macAddress: string | null;

  @Column("bigint", { name: "bytes_in", nullable: true })
  bytesIn: string | null;

  @Column("bigint", { name: "bytes_out", nullable: true })
  bytesOut: string | null;

  @Column("int", { name: "session_time", nullable: true })
  sessionTime: number | null;

  @Column("varchar", { name: "nas_ip", nullable: true, length: 15 })
  nasIp: string | null;

  @Column("datetime", { name: "timestamp", nullable: true })
  timestamp: Date | null;
}
