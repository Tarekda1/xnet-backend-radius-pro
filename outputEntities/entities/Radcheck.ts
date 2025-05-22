import {
  Column,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserDetails } from "./UserDetails";
import { UserMac } from "./UserMac";

@Index("idx_username", ["username"], {})
@Entity("radcheck", { schema: "radius" })
export class Radcheck {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "username", length: 64 })
  username: string;

  @Column("varchar", { name: "attribute", length: 64 })
  attribute: string;

  @Column("varchar", { name: "op", length: 2, default: () => "':='" })
  op: string;

  @Column("varchar", { name: "value", length: 253 })
  value: string;

  @OneToOne(() => UserDetails, (userDetails) => userDetails.username2)
  userDetails: UserDetails;

  @OneToOne(() => UserMac, (userMac) => userMac.username2)
  userMac: UserMac;
}
