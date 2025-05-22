import { DataSource } from 'typeorm';
import 'reflect-metadata';
import { SessionTrackingSubscriber } from './subscribers/sessionTrackingSubscriber';

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "host.docker.internal",
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USERNAME || "radius",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "radius",
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING_ENABLED === 'true',
    entities: ["src/db/entities/**/*.ts"],
    migrations: ["src/db/migrations/**/*.ts"],
    subscribers: [SessionTrackingSubscriber]
});

export const initializeDB = async () => {
    try {
        await AppDataSource.initialize();
        console.log("Database connection established");
    } catch (error) {
        console.error("Error connecting to database:", error);
        process.exit(1);
    }
};