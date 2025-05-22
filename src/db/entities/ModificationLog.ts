import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { ExternalInvoice } from './ExternalInvoice';

@Entity('modification_logs')
export class ModificationLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type :"int", nullable: true})
    invoiceId: number;

    @Column()
    username: string;

    @Column()
    action: string;

    @CreateDateColumn()
    timestamp: Date;

    @Column('json', { nullable: true })
    changes: Record<string, any>;

    @ManyToOne(() => ExternalInvoice, { onDelete: 'SET NULL' })
    invoice: ExternalInvoice;
}