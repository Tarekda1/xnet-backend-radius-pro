import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("nasname_index", ["nasname"], {})
@Entity("nas", { schema: "radius" })
export class Nas {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id!: number;

  @Column("varchar", { name: "nasname", length: 128 })
  nasname!: string;

  @Column("varchar", { name: "shortname", nullable: true, length: 32 })
  shortname!: string | null;

  @Column("varchar", {
    name: "type",
    nullable: true,
    length: 30,
    default: () => "'other'",
  })
  type!: string | null;

  @Column("int", { name: "ports", nullable: true })
  ports!: number | null;

  @Column("varchar", { name: "secret", length: 60 })
  secret!: string;

  @Column("varchar", { name: "server", nullable: true, length: 64 })
  server!: string | null;

  @Column("varchar", { name: "community", nullable: true, length: 50 })
  community!: string | null;

  @Column("varchar", { name: "description", nullable: true, length: 200 })
  description!: string | null;
}
