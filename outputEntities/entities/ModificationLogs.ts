import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ExternalInvoices } from "./ExternalInvoices";

@Entity("modification_logs", { schema: "radius" })
export class ModificationLogs {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "action", length: 255 })
  action: string;

  @Column("json", { name: "changes", nullable: true })
  changes: object | null;

  @Column("varchar", { name: "username", length: 255 })
  username: string;

  @Column("datetime", {
    name: "timestamp",
    default: () => "'CURRENT_TIMESTAMP(6)'",
  })
  timestamp: Date;

  @ManyToOne(
    () => ExternalInvoices,
    (externalInvoices) => externalInvoices.modificationLogs,
    { onDelete: "CASCADE", onUpdate: "NO ACTION" }
  )
  @JoinColumn([{ name: "invoiceId", referencedColumnName: "id" }])
  invoice: ExternalInvoices;
}
