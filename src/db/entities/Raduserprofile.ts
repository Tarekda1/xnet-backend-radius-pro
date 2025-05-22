import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Radprofile } from "./Radprofile";
import { UserMac } from "./UserMac";
import { UserDetails } from "./UserDetails";

@Index("profile_id", ["profileId"], {})
@Entity("raduserprofile", { schema: "radius" })
export class Raduserprofile {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id!: number;

  @Column("varchar", { name: "username", length: 64 })
  username!: string;

  @Column("int", { name: "profile_id" })
  profileId!: number;

  @Column("tinyint", {
    name: "is_fallback",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  isFallback!: boolean | null;

  @Column("tinyint", {
    name: "is_monthly_exceeded",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  isMonthlyExceeded!: boolean | null;

  @Column("int", {
    name: "quota_reset_day",
    nullable: true,
    default: () => "'1'",
  })
  quotaResetDay!: number | null;

  @Column("varchar", {
    name: "account_status",
    nullable: true,
    length: 20,
    default: () => "'active'",
  })
  accountStatus!: string | null;

  @ManyToOne(() => Radprofile, (radprofile) => radprofile.raduserprofiles, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "profile_id", referencedColumnName: "id" }])
  profile!: Radprofile;

  isOnline?: boolean;
}
