import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from "typeorm";
import { SessionTracking } from "../entities/SessionTracking";
//import { io } from '../../server';
import { get } from "http";
import { getOnlineUsers } from "../../repo/onlineUsers";

@EventSubscriber()
export class SessionTrackingSubscriber implements EntitySubscriberInterface<SessionTracking> {
    listenTo() {
        return SessionTracking;
    }

    async afterUpdate(event: UpdateEvent<SessionTracking>) {
        console.log('afterUpdate', event?.entity?.status);
        const userMetrics = await getOnlineUsers();
        //if (event?.entity?.status === 'completed') {
        //io.emit('sessionStatusUpdate', userMetrics);
        //}
    }
}