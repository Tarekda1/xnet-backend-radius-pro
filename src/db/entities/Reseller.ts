import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ResellerLedgerEntry } from "./ResellerLedgerEntry";

@Index("uniq_reseller_code", ["code"], { unique: true })
@Entity("resellers", { schema: "radius" })
export class Reseller {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "name", length: 128 })
  name: string;

  @Column("varchar", { name: "code", length: 64 })
  code: string;

  @Column("tinyint", { name: "is_active", width: 1, default: () => "'1'" })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;

  @OneToMany(() => ResellerLedgerEntry, (e) => e.reseller)
  ledgerEntries: ResellerLedgerEntry[];
}

