import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SystemUsers } from "./SystemUsers";

@Index("user_id", ["userId"], {})
@Entity("refresh_tokens", { schema: "radius" })
export class RefreshTokens {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "token", length: 255 })
  token: string;

  @Column("int", { name: "user_id" })
  userId: number;

  @Column("timestamp", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @Column("timestamp", { name: "revoked_at", nullable: true })
  revokedAt: Date | null;

  @ManyToOne(() => SystemUsers, (systemUsers) => systemUsers.refreshTokens, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: SystemUsers;
}
