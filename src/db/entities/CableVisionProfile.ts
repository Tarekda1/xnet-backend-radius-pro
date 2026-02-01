import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CableVisionAccount } from "./CableVisionAccount";
import { CableVisionInvoice } from "./CableVisionInvoice";

@Index("IDX_cv_profiles_account_profileIndex_unique", ["accountId", "profileIndex"], { unique: true })
@Index("IDX_cv_profiles_accountId", ["accountId"])
@Entity("cable_vision_profiles", { schema: "radius" })
export class CableVisionProfile {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id?: number;

  @Column("int", { name: "accountId" })
  accountId: number;

  // 1..5 (each Cable Vision account supports up to 5 profiles/devices)
  @Column("tinyint", { name: "profileIndex", width: 1 })
  profileIndex: number;

  @Column("varchar", { name: "profileName", length: 64 })
  profileName: string;

  // Free-text for who is currently using this profile/device slot
  @Column("varchar", { name: "assignedTo", length: 128, nullable: true })
  assignedTo: string | null;

  // Optional device identifier / MAC / STB id / etc.
  @Column("varchar", { name: "deviceId", length: 128, nullable: true })
  deviceId: string | null;

  @Column("float", { name: "monthlyFee", precision: 12, default: () => "0" })
  monthlyFee: number;

  @Column("varchar", { name: "status", length: 16, default: () => "'active'" })
  status: "active" | "inactive";

  @Column("varchar", { name: "deletedBy", length: 64, nullable: true })
  deletedBy?: string | null;

  @CreateDateColumn({ name: "createdAt", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updatedAt", type: "timestamp" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deletedAt", type: "datetime", nullable: true })
  deletedAt?: Date | null;

  @ManyToOne(() => CableVisionAccount, (a) => a.profiles, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "accountId", referencedColumnName: "id" }])
  account?: CableVisionAccount;

  @OneToMany(() => CableVisionInvoice, (i) => i.profile)
  invoices?: CableVisionInvoice[];
}

