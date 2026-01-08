import 'reflect-metadata';

import express from 'express';
import radius from 'radius';
import dgram from 'dgram';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/authRoutes';
import { initializeDB } from './db/config';
import radiusRoutes from './routes/radiusRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { securityMiddleware } from './middleware/security';
import dotenv from 'dotenv';
import { Logger, loggerMiddleware, requestLogger } from './logging/logging';
import 'reflect-metadata';
import profileRoutes from './routes/profileRoutes';
import sessionRoutes from './routes/sessionRoutes';
import { createServer } from 'http';
import { startConsumer } from './bus/userActionsConsumer';
import nasRoutes from './routes/nasRoutes';
import cron from "node-cron";
import { generateMonthlyInvoices } from './services/invoiceService';
import { SessionTrackingWatcher } from './watchers/SessionTrackingWatcher';
import { WebSocketServer } from 'ws';
import invoiceRoutes from './routes/invoiceRoutes';
import alertRoutes from './routes/alertRoutes';
import bandwidthRoutes from './routes/bandwidthRoutes';
import expenseRoutes from './routes/expenseRoutes';
import './events/invoiceListeners'
import cors from 'cors';
import eventBus from './bus/eventBusSingleton';

dotenv.config();

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS
app.use(cors());

const server = createServer(app);

// Create WebSocket server on the same HTTP server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws: any) => {
    console.log('✅ WebSocket client connected');
    clients.add(ws);

    // Start the watcher
    const watcher = new SessionTrackingWatcher(ws);

    if (!watcher.started) {
        watcher.start();
        watcher.started = true;
    }

    ws.on('close', () => {
        console.log('❌ WebSocket client disconnected');
        clients.delete(ws);
    });
});

// Function to broadcast messages to all connected clients
export const broadcastMessage = (message: any) => {
    const messageStr = JSON.stringify(message);
    clients.forEach((client:any) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
};

// Apply security middlewares
securityMiddleware(app);

const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret';

app.set("trust proxy", true);

// Use the requestLogger middleware
app.use(requestLogger);

// Then, use express-winston middleware to log detailed request/response info
app.use(loggerMiddleware);

// Apply rate limiting
app.use('/api/', apiLimiter);

// Use the auth routes
app.use('/api/auth', authRoutes);

// Use the health check routes
app.use('/api', healthRoutes);

app.use('/api', nasRoutes);

app.use('/api/radius', radiusRoutes);

app.use('/api', profileRoutes);

app.use('/api', sessionRoutes);

app.use("/api/invoices", invoiceRoutes);

app.use("/api/alerts", alertRoutes);

app.use("/api/bandwidth", bandwidthRoutes);

app.use("/api/expenses", expenseRoutes);

cron.schedule("0 0 1 * *", async () => {
    console.log("Running monthly invoice generation...");
    await generateMonthlyInvoices();
  });

// RADIUS server setup
const radiusServer = dgram.createSocket('udp4');

// Hardcoded user database
const users: { [key: string]: string } = {
    'testuser': 'password123'
};

//const client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');

async function logSession(username: string, action: string): Promise<void> {
    // try {
    //     await client.connect();
    //     const database = client.db('radius');
    //     const sessions = database.collection('sessions');
    //     await sessions.insertOne({ username: username, action: action, timestamp: new Date() });
    // } finally {
    //     await client.close();
    // }
}

radiusServer.on('message', async (msg, rinfo) => {
    const packet = radius.decode({ packet: msg, secret: process.env.RADIUS_SECRET || 'your_secret' });

    // Check if the packet is from RADIUS
    if (!packet) {
        console.log('Non-RADIUS packet received, ignoring.');
        return;
    }

    console.log('RADIUS packet received:', packet);

    // Handle Access-Request
    if (packet.code === 'Access-Request') {
        const username = packet.attributes['User-Name'];
        const password = packet.attributes['User-Password'];

        if (users[username] && users[username] === password) {
            await logSession(username, 'login');
            console.log('User logged in:', username);
        } else {
            console.log('Access-Reject for user:', username);
        }
    }

    // Handle Accounting-Request
    if (packet.code === 'Accounting-Request') {
        const username = packet.attributes['User-Name'];
        const action = packet.attributes['Acct-Status-Type'];

        await logSession(username, action);
        console.log('Accounting action:', action, 'for user:', username);
    }
});

//radiusServer.bind(1812);

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Xnet Backend Radius Pro API',
            version: '1.0.0',
            description: 'API documentation for Xnet Backend Radius Pro',
        },
        servers: [
            {
                url: 'http://localhost:3000',
            },
        ],
    },
    apis: ['./src/controllers/*.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Basic route
app.get('/', (req, res) => {
    res.send('Xnet server is running');
});

// Error handling middleware
app.use(errorHandler);

// Start the consumer in the background
startConsumer().catch((err) => console.error('Consumer error:', err));

// Initialize database before starting server
initializeDB().then(() => {
    server.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
    });
});

process.on('unhandledRejection', (reason) => {
  Logger.getInstance().error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  Logger.getInstance().error('Uncaught exception:', err);
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Subscribe to event bus notifications
  const handleNotification = async (data: any) => {
    if (ws.readyState === ws.OPEN) {
      try {
        await eventBus.publish({
          type: 'INVOICE_PAID',
          ...data
        });
        ws.send(JSON.stringify({
          type: 'INVOICE_PAID',
          ...data
        }));
      } catch (error) {
        console.error('Error publishing notification:', error);
      }
    }
  };

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      await handleNotification(data);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// export { io }