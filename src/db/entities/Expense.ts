import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("expenses", { schema: "radius" })
export class Expense {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id?: number;

  @Column("varchar", { name: "title", length: 128 })
  title: string;

  @Column("varchar", { name: "category", length: 64, nullable: true })
  category: string | null;

  @Column("float", { name: "amount", precision: 12 })
  amount: number;

  @Column("varchar", { name: "currency", length: 8, default: () => "'USD'" })
  currency: string;

  @Column("date", { name: "expenseDate" })
  expenseDate: string;

  @Column("varchar", {
    name: "status",
    length: 16,
    default: () => "'unpaid'",
  })
  status: "paid" | "unpaid";

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  @Column("varchar", { name: "createdBy", length: 64, nullable: true })
  createdBy: string | null;

  @Column("varchar", { name: "updatedBy", length: 64, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: "createdAt", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updatedAt", type: "timestamp" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deletedAt", type: "datetime", nullable: true })
  deletedAt?: Date | null;
}


