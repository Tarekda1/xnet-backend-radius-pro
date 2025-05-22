import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("username", ["username", "day"], { unique: true })
@Entity("radusagestats", { schema: "radius" })
export class Radusagestats {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id!: string;

  @Column("varchar", { name: "username", length: 64 })
  username!: string;

  @Column("date", { name: "day" })
  day!: string;

  @Column("bigint", { name: "data_usage", default: () => "'0'" })
  dataUsage!: string;
}
