import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { RefreshTokens } from "./RefreshTokens";
import { UserPermissionOverride } from "./UserPermissionOverride";

@Index("username", ["username"], { unique: true })
@Index("email", ["email"], { unique: true })
@Index("IDX_524dc73f94ac2e5120dfd7ed4b", ["username"], { unique: true })
@Index("IDX_73dff187ed765e8403bf5fc911", ["email"], { unique: true })
@Entity("system_users", { schema: "radius" })
export class SystemUsers {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "username", unique: true, length: 64 })
  username: string;

  @Column("varchar", { name: "email", unique: true, length: 128 })
  email: string;

  @Column("varchar", { name: "password", length: 255 })
  password: string;

  @Column("tinyint", {
    name: "must_change_password",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  mustChangePassword: boolean | null;

  @Column("timestamp", { name: "password_changed_at", nullable: true })
  passwordChangedAt: Date | null;

  @Column("enum", {
    name: "role",
    nullable: true,
    enum: ["admin", "manager", "support", "collector", "reseller"],
    default: 'support',
  })
  role: "admin" | "manager" | "support" | "collector" | "reseller" | null;

  @Column("int", { name: "reseller_id", nullable: true })
  resellerId: number | null;

  @Column("tinyint", {
    name: "is_active",
    nullable: true,
    width: 1,
    default: () => "'1'",
  })
  isActive: boolean | null;

  @Column("timestamp", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @Column("timestamp", {
    name: "updated_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date | null;

  @Column("timestamp", { name: "last_login", nullable: true })
  lastLogin: Date | null;

  @OneToMany(() => RefreshTokens, (refreshTokens) => refreshTokens.user)
  refreshTokens: RefreshTokens[];

  @OneToMany(() => UserPermissionOverride, (o) => o.user)
  permissionOverrides: UserPermissionOverride[];
}
