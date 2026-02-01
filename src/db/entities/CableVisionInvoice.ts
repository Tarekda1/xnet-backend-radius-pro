import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CableVisionAccount } from "./CableVisionAccount";
import { CableVisionProfile } from "./CableVisionProfile";

@Index("IDX_cv_invoices_accountId", ["accountId"])
@Index("IDX_cv_invoices_profileId", ["profileId"])
@Index("IDX_cv_invoices_billingMonth", ["billingMonth"])
@Index("IDX_cv_invoices_profile_billing_unique", ["profileId", "billingMonth"], { unique: true })
@Entity("cable_vision_invoices", { schema: "radius" })
export class CableVisionInvoice {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id?: number;

  @Column("int", { name: "accountId" })
  accountId: number;

  @Column("int", { name: "profileId", nullable: true })
  profileId: number | null;

  @Column("float", { name: "amount", precision: 12 })
  amount: number;

  @Column("varchar", { name: "status", length: 10, default: () => "'unpaid'" })
  status: "paid" | "unpaid" | "pending";

  // YYYY-MM-01
  @Column("date", { name: "billingMonth" })
  billingMonth: string;

  @CreateDateColumn({ name: "createdAt", type: "timestamp" })
  createdAt: Date;

  @Column("timestamp", { name: "paidAt", nullable: true })
  paidAt: Date | null;

  @Column("varchar", { name: "paymentMethod", nullable: true, length: 20 })
  paymentMethod: "cash" | "pos" | "transfer" | "other" | null;

  @Column("varchar", { name: "collectedBy", nullable: true, length: 64 })
  collectedBy: string | null;

  @Column("timestamp", { name: "collectedAt", nullable: true })
  collectedAt: Date | null;

  @Column("tinyint", { name: "cashReconciled", width: 1, default: () => "'0'" })
  cashReconciled: boolean;

  @Column("varchar", { name: "reconciledBy", nullable: true, length: 64 })
  reconciledBy: string | null;

  @Column("timestamp", { name: "reconciledAt", nullable: true })
  reconciledAt: Date | null;

  @Column("varchar", { name: "modifiedBy", nullable: true, length: 64 })
  modifiedBy?: string | null;

  @Column("varchar", { name: "deletedBy", nullable: true, length: 64 })
  deletedBy?: string | null;

  @Column("varchar", { name: "lastAction", nullable: true, length: 255 })
  lastAction: string | null;

  @Column("datetime", { name: "modifiedAt", nullable: true })
  modifiedAt?: Date | null;

  @DeleteDateColumn({ name: "deletedAt", type: "datetime", nullable: true })
  deletedAt?: Date | null;

  @ManyToOne(() => CableVisionAccount, (a) => a.invoices, { onDelete: "RESTRICT" })
  @JoinColumn([{ name: "accountId", referencedColumnName: "id" }])
  account?: CableVisionAccount;

  @ManyToOne(() => CableVisionProfile, (p) => p.invoices, { onDelete: "SET NULL" })
  @JoinColumn([{ name: "profileId", referencedColumnName: "id" }])
  profile?: CableVisionProfile;
}

