import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("settings", { schema: "radius" })
export class Settings {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("time", { name: "night_start" })
  nightStart: string;

  @Column("time", { name: "night_end" })
  nightEnd: string;

  @Column("varchar", { name: "key_attribute", length: 255 })
  keyAttribute: string;

  @Column("tinyint", { name: "if_enabled", width: 1, default: () => "'1'" })
  ifEnabled: boolean;
}
