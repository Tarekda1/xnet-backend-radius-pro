import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
  } from "typeorm";
  import { ExternalInvoice } from "./ExternalInvoice";
  
  @Entity("modification_logs", { schema: "radius" })
  export class ModificationLog {
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
      () => ExternalInvoice,
      (externalInvoice) => externalInvoice.modificationLog,
      { onDelete: "CASCADE", onUpdate: "NO ACTION" }
    )
    @JoinColumn([{ name: "invoiceId", referencedColumnName: "id" }])
    invoice: ExternalInvoice;
  }
  