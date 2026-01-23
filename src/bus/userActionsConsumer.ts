// userActionsConsumer.ts
import amqp from 'amqplib';
import { AppDataSource } from '../db/config';
import { UserController } from '../controllers/userController';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function startConsumer() {
  const rabbitMqUrl = process.env.RABBITMQ_URL || 'amqp://127.0.0.1:5672';
  const connection = await amqp.connect(rabbitMqUrl);
  const channel = await connection.createChannel();
  const queue = 'user_actions_queue';
  await channel.assertQueue(queue, { durable: true });
  console.log(`Waiting for messages in ${queue}...`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      const message = JSON.parse(msg.content.toString());
      if (message.action === 'disconnectAndCompleteSession') {
        const { username, ip, code, port } = message;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        // Disconnect the user
        await UserController.disconnectUser(username, ip, code, typeof port === "number" ? port : undefined);
        await delay(5000); 
        // Update session_tracking to mark active session as completed
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
          await queryRunner.query(
            `UPDATE session_tracking 
             SET daily_bytes_in = 0, daily_bytes_out = 0, daily_session_time = 0,
             bytes_in = 0, bytes_out = 0, session_time = 0, last_update = NOW(), end_time = NOW(), status = 'completed'
             WHERE username = ? AND (DATE(end_time) = ? OR end_time IS NULL)`,
            [username, today]
          );
        } catch (error) {
          console.error('Error updating session tracking:', error);
        } finally {
          await queryRunner.release();
        }
      }
      channel.ack(msg);
    }
  });
}

