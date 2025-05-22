// src/entities/Invoice.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Raduserprofile } from "./Raduserprofile";
import { UserDetails } from "./UserDetails";

@Entity("invoices", { schema: "radius" })
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Raduserprofile, (userProfile) => userProfile.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_profile_id" })
  userProfile!: Raduserprofile;

  @Column("date")
  billingMonth!: Date;

  @Column("float")
  amount!: number;

  @Column({ type: "varchar", length: 10, default: "unpaid" })
  status!: "paid" | "unpaid";

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  paidAt!: Date | null;

  @ManyToOne(() => UserDetails, (userDetails) => userDetails.username, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "user_details_id", referencedColumnName: "username" }])
  userDetails!: UserDetails;

}
