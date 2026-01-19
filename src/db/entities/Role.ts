import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { RolePermission } from "./RolePermission";

@Index("IDX_roles_key_unique", ["key"], { unique: true })
@Entity("roles", { schema: "radius" })
export class Role {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  // Must match existing SystemUsers.role values (admin/manager/support/collector)
  @Column("varchar", { name: "key", length: 64 })
  key: string;

  @Column("varchar", { name: "name", length: 128 })
  name: string;

  @Column("varchar", { name: "description", nullable: true, length: 255 })
  description: string | null;

  @OneToMany(() => RolePermission, (p) => p.role)
  permissions: RolePermission[];
}

