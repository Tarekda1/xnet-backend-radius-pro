import { invoiceEvents } from './invoiceEvents';
import { AppDataSource } from '../db/config';
import { ModificationLog } from '../db/entities/ModificationLog';
import { ExternalInvoice } from '../db/entities/ExternalInvoice';

invoiceEvents.on('invoice:modification', async (modification) => {
    const logRepo = AppDataSource.getRepository(ModificationLog);
    const invoiceRepo = AppDataSource.getRepository(ExternalInvoice);

    console.log('Modification event triggered:', modification);

    try {
        // Create log entry
        const log = new ModificationLog();
        log.invoiceId = modification.invoiceId;
        log.username = modification.username;
        log.action = modification.action;
        log.timestamp = modification.timestamp;
        log.changes = modification.changes;
        await logRepo.save(log);

        // Update invoice's last modification info if not deleted
        if (modification.action !== 'DELETE') {
            const invoice = await invoiceRepo.findOne({ where: { id: modification.invoiceId } });
            if (invoice) {
                invoice.modifiedBy = modification.username;
                invoice.modifiedAt = modification.timestamp;
                invoice.lastAction = modification.action;
                await invoiceRepo.save(invoice);
            }
        }

        console.log(`Invoice ${modification.invoiceId} ${modification.action.toLowerCase()}d by ${modification.username} at ${modification.timestamp}`);
        if (modification.changes) {
            console.log('Changes:', modification.changes);
        }
    } catch (error) {
        console.error('Error saving modification log:', error);
    }
});