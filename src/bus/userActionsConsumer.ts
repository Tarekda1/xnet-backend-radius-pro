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
        const result = await UserController.disconnectUser(username, ip, code, typeof port === "number" ? port : undefined);
        if (!result.ok) {
          console.error(`❌ Consumer disconnect failed for ${username}:`, result.error);
        }
        await delay(5000);

        // Only mark session_tracking completed if RADIUS accounting actually stopped (or became stale).
        // Otherwise we can end up with: radacct still updating while session_tracking is "completed".
        const staleSecondsRaw = parseInt(process.env.ONLINE_SESSION_STALE_SECONDS || "300", 10);
        const staleSeconds = Number.isFinite(staleSecondsRaw) && staleSecondsRaw > 0 ? staleSecondsRaw : 300;
        const staleCutoff = new Date(Date.now() - staleSeconds * 1000);

        // Update session_tracking to mark active session as completed
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        try {
          const stillOnlineRow = await queryRunner.query(
            `
            SELECT 1 AS ok
            FROM radacct ra
            WHERE ra.username = ?
              AND ra.acctstoptime IS NULL
              AND COALESCE(ra.acctupdatetime, ra.acctstarttime) >= ?
            LIMIT 1;
            `,
            [username, staleCutoff]
          );

          const stillOnline = Array.isArray(stillOnlineRow) && stillOnlineRow.length > 0;
          if (stillOnline) {
            console.warn(`⚠️ Skipping session_tracking completion for ${username}: radacct still online (fresh).`);
            channel.ack(msg);
            return;
          }

          await queryRunner.query(
            `UPDATE session_tracking 
             SET daily_bytes_in = 0, daily_bytes_out = 0, daily_session_time = 0,
             bytes_in = 0, bytes_out = 0, session_time = 0, last_update = NOW(), end_time = NOW(), status = 'completed'
             WHERE username = ? AND status = 'active' AND end_time IS NULL`,
            [username]
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

