import express from 'express';
import creatAdminRouter from './routes/admin';
import createCustomerRouter from './routes/customer';
import { QueueOperationKafkaBrokerService } from './services/queueOperationBrokerService';
import { setupKafka, setupRethinkDb } from './setup';
import { QueueOperationsRethinkDbService } from './services/queueOperationsDbService';
import { QueueOperation } from './models';
import { QueueOperationsStateMachine } from './services/queueOperationsStateMachine';
import http from 'http';
import { Server } from 'socket.io';
import { RealTimeQueryService } from './services/realTimeQueryService';
import { logger } from './logger';
import { logLevel } from 'kafkajs';
import cors from 'cors';

export type AppConfig = {
  express: {
    port: number;
  };
  socketIo: {
    port: number;
  };
  reset: boolean;
  rethinkDb: {
    db: string;
    table: string;
    host: string;
    port: number;
  };
  kafka: {
    broker: string;
    topic: string;
    logLevel?: logLevel;
  };
};

export async function createServer(config: AppConfig) {
  const app = express();
  const corsOption: cors.CorsOptions = {
    origin: [
      'http://localhost:3000',
      'https://electron-socket-io-playground.vercel.app',
    ],
    methods: ['GET', 'POST'],
  };
  app.use(cors(corsOption));
  app.use(express.json());

  const server = await app.listen(config.express.port);
  const socketIoServer = http.createServer();
  await socketIoServer.listen(config.socketIo.port);
  const io = new Server(socketIoServer, {
    cors: corsOption,
  });

  const conn = await setupRethinkDb({
    host: config.rethinkDb.host,
    port: config.rethinkDb.port,
    db: config.rethinkDb.db,
    table: config.rethinkDb.table,
    reset: config.reset,
  });

  const { producer, createConsumer } = await setupKafka({
    reset: config.reset,
    broker: config.kafka.broker,
    topic: config.kafka.topic,
    logLevel: config.kafka.logLevel,
  });

  const queueOperationsRethinkDbService = new QueueOperationsRethinkDbService({
    conn: conn,
    table: config.rethinkDb.table,
  });
  const queueOperationsStateMachine = new QueueOperationsStateMachine(
    queueOperationsRethinkDbService
  );

  const queueOperations = new QueueOperationKafkaBrokerService({
    topic: config.kafka.topic,
    producer,
  });

  app.use('/admin', creatAdminRouter(queueOperations));
  app.use('/customer', createCustomerRouter(queueOperations));

  const realTimeQueryService = new RealTimeQueryService(
    config.rethinkDb.table,
    conn
  );
  io.on('connect', (socket) => {
    logger.info(`io connect ${socket.id}`);
    realTimeQueryService.addSocket(socket);
  });

  const consumer = createConsumer();
  await consumer.on((event) => {
    switch (event.op) {
      case QueueOperation.JoinQueue: {
        queueOperationsStateMachine
          .onJoinQueue(event)
          .then(() =>
            logger.verbose(
              `${QueueOperation.JoinQueue}: ${JSON.stringify(event)}`
            )
          );
        break;
      }
      case QueueOperation.Serve: {
        queueOperationsStateMachine.onServe(event);
        break;
      }
    }
  });

  const shutdown = async () => {
    await socketIoServer.close();
    realTimeQueryService.cleanup();
    await io.close();
    await conn.close();
    await consumer.close();
    await producer.disconnect();
    await server.close();
  };

  return {
    shutdown,
  };
}
