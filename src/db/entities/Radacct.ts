import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("username_index", ["username"], {})
@Index("framedipaddress_index", ["framedipaddress"], {})
@Index("acctsessionid_index", ["acctsessionid"], {})
@Index("acctuniqueid_index", ["acctuniqueid"], {})
@Index("acctstarttime_index", ["acctstarttime"], {})
@Index("acctstoptime_index", ["acctstoptime"], {})
@Index("nasipaddress_index", ["nasipaddress"], {})
@Index(
  "radacct_active_session_idx",
  ["username", "acctstarttime", "acctstoptime"],
  {}
)
@Index(
  "radacct_bulk_close",
  ["nasipaddress", "acctstarttime", "acctstoptime"],
  {}
)
@Entity("radacct", { schema: "radius" })
export class Radacct {
  @PrimaryGeneratedColumn({ type: "bigint", name: "radacctid" })
  radacctid!: string;

  @Column("varchar", { name: "acctsessionid", length: 64 })
  acctsessionid!: string;

  @Column("varchar", { name: "acctuniqueid", length: 32 })
  acctuniqueid!: string;

  @Column("varchar", { name: "username", length: 64 })
  username!: string;

  @Column("varchar", { name: "realm", nullable: true, length: 64 })
  realm!: string | null;

  @Column("varchar", { name: "nasipaddress", length: 15 })
  nasipaddress!: string;

  @Column("varchar", { name: "nasportid", nullable: true, length: 32 })
  nasportid!: string | null;

  @Column("varchar", { name: "nasporttype", nullable: true, length: 32 })
  nasporttype!: string | null;

  @Column("datetime", { name: "acctstarttime", nullable: true })
  acctstarttime!: Date | null;

  @Column("datetime", { name: "acctupdatetime", nullable: true })
  acctupdatetime!: Date | null;

  @Column("datetime", { name: "acctstoptime", nullable: true })
  acctstoptime!: Date | null;

  @Column("int", { name: "acctinterval", nullable: true })
  acctinterval!: number | null;

  @Column("int", { name: "acctsessiontime", nullable: true, unsigned: true })
  acctsessiontime!: number | null;

  @Column("varchar", { name: "acctauthentic", nullable: true, length: 32 })
  acctauthentic!: string | null;

  @Column("varchar", { name: "connectinfo_start", nullable: true, length: 50 })
  connectinfoStart!: string | null;

  @Column("varchar", { name: "connectinfo_stop", nullable: true, length: 50 })
  connectinfoStop!: string | null;

  @Column("bigint", { name: "acctinputoctets", nullable: true })
  acctinputoctets!: string | null;

  @Column("bigint", { name: "acctoutputoctets", nullable: true })
  acctoutputoctets!: string | null;

  @Column("varchar", { name: "calledstationid", nullable: true, length: 50 })
  calledstationid!: string | null;

  @Column("varchar", { name: "callingstationid", nullable: true, length: 50 })
  callingstationid!: string | null;

  @Column("varchar", { name: "acctterminatecause", nullable: true, length: 32 })
  acctterminatecause!: string | null;

  @Column("varchar", { name: "servicetype", nullable: true, length: 32 })
  servicetype!: string | null;

  @Column("varchar", { name: "framedprotocol", nullable: true, length: 32 })
  framedprotocol!: string | null;

  @Column("varchar", { name: "framedipaddress", nullable: true, length: 15 })
  framedipaddress!: string | null;

  @Column("varchar", { name: "framedipv6address", nullable: true, length: 45 })
  framedipv6address!: string | null;

  @Column("varchar", { name: "framedipv6prefix", nullable: true, length: 45 })
  framedipv6prefix!: string | null;

  @Column("varchar", { name: "framedinterfaceid", nullable: true, length: 44 })
  framedinterfaceid!: string | null;

  @Column("varchar", {
    name: "delegatedipv6prefix",
    nullable: true,
    length: 45,
  })
  delegatedipv6prefix!: string | null;
}
