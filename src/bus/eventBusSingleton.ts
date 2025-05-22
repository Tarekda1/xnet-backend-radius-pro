// eventBusSingleton.ts
import { EventBus } from './eventBus';

const eventBus = new EventBus();

eventBus.connect()
  .then(() => console.log('EventBus connected successfully.'))
  .catch((err) => console.error('Failed to connect EventBus:', err));

export default eventBus;
