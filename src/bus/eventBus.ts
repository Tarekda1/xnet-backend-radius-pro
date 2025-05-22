import * as amqp from 'amqplib';

interface ExtendedConnection extends amqp.Connection {
  serverProperties: any;
  expectSocketClose: boolean;
  sentSinceLastCheck: boolean;
  recvSinceLastCheck: boolean;
  sendMessage: (content: Buffer) => void;
}

export class EventBus {
  private connection!: any;
  private channel: amqp.Channel | undefined;
  private readonly queue = 'user_actions_queue';
  rabbitMqUrl = process.env.RABBITMQ_URL || 'amqp://127.0.0.1:5672';

  async connect(): Promise<void> {
    // Explicitly type the local variables
    this.connection = await amqp.connect(this.rabbitMqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel?.assertQueue(this.queue, { durable: true });
  }

  async publish(message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel is not initialized.');
    }
    this.channel.sendToQueue(
      this.queue,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}
