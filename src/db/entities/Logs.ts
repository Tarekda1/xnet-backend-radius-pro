import 'reflect-metadata';
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("logs", { schema: "radius" })
export class Logs {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "level", length: 255 })
  level: string;

  @Column("varchar", { name: "message", length: 255 })
  message: string;

  @Column("json", { name: "meta", nullable: true })
  meta: object | null;

  @Column("timestamp", {
    name: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  timestamp: Date;
}
