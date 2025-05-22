import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Raduserprofile } from "./Raduserprofile";

@Entity("radprofile", { schema: "radius" })
export class Radprofile {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "profile_name", length: 64 })
  profileName: string;

  @Column("bigint", { name: "daily_quota" })
  dailyQuota: string;

  @Column("bigint", { name: "monthly_quota" })
  monthlyQuota: string;

  @Column("time", { name: "night_start", nullable: true })
  nightStart: string | null;

  @Column("time", { name: "night_end", nullable: true })
  nightEnd: string | null;

  @Column("int", { name: "speed_down", nullable: true, default: () => "'0'" })
  speedDown: number | null;

  @Column("int", { name: "speed_up", nullable: true, default: () => "'0'" })
  speedUp: number | null;

  @Column("int", {
    name: "session_timeout",
    nullable: true,
    default: () => "'3600'",
  })
  sessionTimeout: number | null;

  @Column("int", {
    name: "idle_timeout",
    nullable: true,
    default: () => "'600'",
  })
  idleTimeout: number | null;

  @Column("int", { name: "max_sessions", nullable: true, default: () => "'1'" })
  maxSessions: number | null;

  @OneToMany(() => Raduserprofile, (raduserprofile) => raduserprofile.profile)
  raduserprofiles: Raduserprofile[];
}
