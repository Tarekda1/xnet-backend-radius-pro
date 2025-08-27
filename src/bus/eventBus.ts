import * as amqp from 'amqplib';
import axios from 'axios';

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
  private readonly rabbitMqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  private readonly managementUrl = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';

  private async deleteQueueViaManagementApi(): Promise<void> {
    try {
      const url = `${this.managementUrl}/api/queues/%2F/${this.queue}`;
      await axios.delete(url, {
        auth: {
          username: 'guest',
          password: 'guest'
        }
      });
      // console.log('Successfully deleted queue via management API');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('Queue does not exist in management API');
      } else {
        console.error('Error deleting queue via management API:', error.message);
      }
    }
  }

  async connect(): Promise<void> {
    try {
      // First try to delete the queue via management API
      await this.deleteQueueViaManagementApi();

      console.log('Connecting to RabbitMQ at:', this.rabbitMqUrl);
      this.connection = await amqp.connect(this.rabbitMqUrl);
      this.channel = await this.connection.createChannel();
      
      // Create the queue with our desired settings
      await this.channel?.assertQueue(this.queue, { 
        durable: true
      });
      
      // console.log('Successfully connected to RabbitMQ and asserted queue:', this.queue);
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return !!this.channel && this.connection && !this.connection.closed;
  }

  async publish(message: any): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel is not initialized.');
    }
    
    try {
      // console.log('Publishing message to queue:', this.queue, 'Message:', message);
      
      const success = this.channel.sendToQueue(
        this.queue,
        Buffer.from(JSON.stringify(message)),
        { 
          persistent: true,
          contentType: 'application/json'
        }
      );
      
      if (!success) {
        console.warn('Message was not sent to queue - queue might be full');
      } else {
        // console.log('Message published successfully');
      }
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }
}
