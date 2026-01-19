import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { SystemUsers } from "./SystemUsers";

export type PermissionEffect = "allow" | "deny";

@Index("IDX_user_permission_overrides_user_permission_unique", ["userId", "permission"], { unique: true })
@Index("IDX_user_permission_overrides_userId", ["userId"])
@Entity("user_permission_overrides", { schema: "radius" })
export class UserPermissionOverride {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("int", { name: "userId" })
  userId: number;

  @Column("varchar", { name: "permission", length: 128 })
  permission: string;

  @Column("enum", { name: "effect", enum: ["allow", "deny"], default: "allow" })
  effect: PermissionEffect;

  @ManyToOne(() => SystemUsers, (u: any) => u.permissionOverrides, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "userId", referencedColumnName: "id" }])
  user: SystemUsers;
}

