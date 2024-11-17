import express from 'express';
import creatAdminRouter from './routes/admin';
import createCustomerRouter from './routes/customer';
import { QueueOperationKafkaProducer } from './services/QueueOperationProducer';
import { setupKafka, setupRethinkDb } from './setup';
import { QueueOperationsRethinkDbService } from './services/queueOperationsDbService';
import { QueueOperation } from './models';
import { QueueOperationsService } from './services/queueOperationsService';
import http from 'http';
import { Server } from 'socket.io';
import { RealTimeQueryService } from './services/realTimeQueryService';
import { setAppLogLevel, createLogger } from './logger';
import cors from 'cors';

export type AppConfig = {
  logLevel?: 'verbose' | 'info';
  express: {
    port: number;
  };
  socketIo: {
    port: number;
  };
  rethinkDb: Parameters<typeof setupRethinkDb>[0];
  kafka: Parameters<typeof setupKafka>[0];
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

  setAppLogLevel(config.logLevel || 'info');

  const server = await app.listen(config.express.port);
  const socketIoServer = http.createServer();
  await socketIoServer.listen(config.socketIo.port);
  const io = new Server(socketIoServer, {
    cors: corsOption,
  });

  const conn = await setupRethinkDb(config.rethinkDb);

  const { producer, createConsumer } = await setupKafka(config.kafka);

  const db = new QueueOperationsRethinkDbService({
    conn: conn,
    table: config.rethinkDb.table,
  });

  const queueOperationsProducer = new QueueOperationKafkaProducer({
    topic: config.kafka.topic,
    producer,
  });

  app.use('/admin', creatAdminRouter(queueOperationsProducer));
  app.use('/customer', createCustomerRouter(queueOperationsProducer));

  const realTimeQueryService = new RealTimeQueryService(
    config.rethinkDb.table,
    conn
  );

  const ioLogger = createLogger('io');
  io.on('connect', (socket) => {
    ioLogger.info(`io connect ${socket.id}`);
    realTimeQueryService.addSocket(socket);
  });

  const queueOperationsConsumer = new QueueOperationsService(db);

  const consumerLogger = createLogger('msg consumer');
  const consumer = createConsumer();
  await consumer.on(async (event) => {
    switch (event.op) {
      case QueueOperation.JoinQueue: {
        await queueOperationsConsumer.onJoinQueue(event);
        break;
      }
      case QueueOperation.Serve: {
        await queueOperationsConsumer.onServe(event);
        break;
      }
    }

    consumerLogger.verbose(`${JSON.stringify(event)}`);
  });

  const shutdown = async () => {
    await socketIoServer.close();
    await realTimeQueryService.cleanup();
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
