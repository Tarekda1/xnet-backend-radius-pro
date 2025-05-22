// src/entities/ExternalInvoice.ts
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, DeleteDateColumn } from "typeorm";

@Entity("external_invoices", { schema: "radius" })
export class ExternalInvoice {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column("varchar", { length: 64 })
  username!: string;

  @Column("varchar", { length: 128 })
  fullName!: string;

  @Column("varchar", { length: 128 })
  email?: string;

  @Column("varchar", { length: 32 })
  phoneNumber!: string;

  @Column("text", { nullable: true })
  address!: string;

  @Column({ type: "varchar", length: 10, default: "" })
  provider!: string;

  @Column("date")
  billingMonth!: Date;

  @Column("float")
  amount!: number;

  @Column({ type: "varchar", length: 10, default: "unpaid" })
  status!: "paid" | "unpaid";

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  paidAt?: Date | null;


  @Column("varchar", { length: 64, nullable: true })
  modifiedBy?: string;

  @UpdateDateColumn()
  modifiedAt?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({
    name: 'deletedBy',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  deletedBy?: string;

  @Column({ type:"varchar", nullable: true })
  lastAction?: string;
}
