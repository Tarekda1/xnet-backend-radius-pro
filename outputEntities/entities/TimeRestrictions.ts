import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("time_restrictions", { schema: "radius" })
export class TimeRestrictions {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("varchar", { name: "username", nullable: true, length: 64 })
  username: string | null;

  @Column("time", { name: "start_time", nullable: true })
  startTime: string | null;

  @Column("time", { name: "end_time", nullable: true })
  endTime: string | null;
}
