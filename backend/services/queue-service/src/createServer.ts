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
  };
};

export async function createServer(config: AppConfig) {
  const app = express();
  app.use(express.json());

  const server = await app.listen(config.express.port);
  const socketIoServer = http.createServer();
  await socketIoServer.listen(config.socketIo.port);
  const io = new Server(socketIoServer, {
    cors: {
      origin: 'https://electron-socket-io-playground.vercel.app',
      methods: ['GET', 'POST'],
    },
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
  const rtqs: RealTimeQueryService[] = [];
  io.on('connect', (socket) => {
    const rtq = new RealTimeQueryService(socket, config.rethinkDb.table, conn);
    rtqs.push(rtq);
  });

  const consumer = createConsumer();
  await consumer.on((event) => {
    switch (event.op) {
      case QueueOperation.JoinQueue: {
        queueOperationsStateMachine.onJoinQueue(event);
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
    for (const rtq of rtqs) {
      await rtq.cleanup();
    }
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
