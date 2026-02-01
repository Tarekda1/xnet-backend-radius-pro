import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CableVisionProfile } from "./CableVisionProfile";
import { CableVisionInvoice } from "./CableVisionInvoice";

@Entity("cable_vision_accounts", { schema: "radius" })
export class CableVisionAccount {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id?: number;

  @Column("varchar", { name: "accountNumber", length: 64, unique: true })
  accountNumber: string;

  @Column("varchar", { name: "fullName", length: 128 })
  fullName: string;

  @Column("varchar", { name: "phoneNumber", length: 32, nullable: true })
  phoneNumber: string | null;

  @Column("varchar", { name: "email", length: 128, nullable: true })
  email: string | null;

  @Column("text", { name: "address", nullable: true })
  address: string | null;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  @Column("varchar", { name: "status", length: 16, default: () => "'active'" })
  status: "active" | "suspended" | "cancelled";

  @Column("varchar", { name: "deletedBy", length: 64, nullable: true })
  deletedBy?: string | null;

  @CreateDateColumn({ name: "createdAt", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updatedAt", type: "timestamp" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deletedAt", type: "datetime", nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => CableVisionProfile, (p) => p.account)
  profiles?: CableVisionProfile[];

  @OneToMany(() => CableVisionInvoice, (i) => i.account)
  invoices?: CableVisionInvoice[];
}

