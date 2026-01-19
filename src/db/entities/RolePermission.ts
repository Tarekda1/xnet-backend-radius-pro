import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Role } from "./Role";

@Index("IDX_role_permissions_role_permission_unique", ["roleId", "permission"], { unique: true })
@Index("IDX_role_permissions_roleId", ["roleId"])
@Entity("role_permissions", { schema: "radius" })
export class RolePermission {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("int", { name: "roleId" })
  roleId: number;

  @Column("varchar", { name: "permission", length: 128 })
  permission: string;

  @ManyToOne(() => Role, (r) => r.permissions, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "roleId", referencedColumnName: "id" }])
  role: Role;
}

