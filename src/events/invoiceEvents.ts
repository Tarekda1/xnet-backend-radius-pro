import { EventEmitter } from 'events';

export interface InvoiceModification {
    invoiceId: number;
    username: string;
    action: 'UPDATE' | 'DELETE' | 'PAY' | 'RECOVER';
    timestamp: Date;
    changes?: Record<string, any>;
}

class InvoiceEventEmitter extends EventEmitter {
    emitModification(modification: InvoiceModification) {
        this.emit('invoice:modification', modification);
    }
}

export const invoiceEvents = new InvoiceEventEmitter();