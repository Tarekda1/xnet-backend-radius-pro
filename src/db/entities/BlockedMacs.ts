import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("blocked_macs", { schema: "radius" })
export class BlockedMacs {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("varchar", { name: "mac_address", nullable: true, length: 17 })
  macAddress: string | null;

  @Column("text", { name: "reason", nullable: true })
  reason: string | null;

  @Column("datetime", { name: "blocked_at", nullable: true })
  blockedAt: Date | null;
}
