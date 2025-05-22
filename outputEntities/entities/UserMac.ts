import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { Radcheck } from "./Radcheck";

@Index("IDX_d348bbe6087d254a9ef3800293", ["macAddress"], { unique: true })
@Index("mac_address", ["macAddress"], { unique: true })
@Entity("user_mac", { schema: "radius" })
export class UserMac {
  @Column("varchar", { primary: true, name: "username", length: 64 })
  username: string;

  @Column("varchar", { name: "mac_address", unique: true, length: 17 })
  macAddress: string;

  @OneToOne(() => Radcheck, (radcheck) => radcheck.userMac, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "username", referencedColumnName: "username" }])
  username2: Radcheck;
}
