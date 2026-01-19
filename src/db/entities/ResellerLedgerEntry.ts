import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Reseller } from "./Reseller";
import { SystemUsers } from "./SystemUsers";

@Index("idx_reseller_ledger_reseller_id", ["resellerId"], {})
@Entity("reseller_ledger", { schema: "radius" })
export class ResellerLedgerEntry {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("int", { name: "reseller_id" })
  resellerId: number;

  @Column("decimal", { name: "amount", precision: 12, scale: 2 })
  amount: string;

  @Column("varchar", { name: "currency", length: 8, default: () => "'USD'" })
  currency: string;

  @Column("enum", { name: "entry_type", enum: ["credit", "debit"] })
  entryType: "credit" | "debit";

  @Column("varchar", { name: "reference_type", length: 64, nullable: true })
  referenceType: string | null;

  @Column("varchar", { name: "reference_id", length: 64, nullable: true })
  referenceId: string | null;

  @Column("varchar", { name: "note", length: 255, nullable: true })
  note: string | null;

  @Column("int", { name: "created_by", nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;

  @ManyToOne(() => Reseller, (r) => r.ledgerEntries, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "reseller_id", referencedColumnName: "id" }])
  reseller: Reseller;

  @ManyToOne(() => SystemUsers, { onDelete: "SET NULL" })
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdByUser: SystemUsers;
}

