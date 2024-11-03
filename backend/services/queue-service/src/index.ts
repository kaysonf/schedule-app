import express from 'express';
import creatAdminRouter from './routes/admin';
import createCustomerRouter from './routes/customer';
import { QueueOperationBrokerService } from './services/queueOperationBrokerService';
import { setupKafka, setupRethinkDb } from './setup';
import { QueueOperationsRethinkDbService } from './services/queueOperationsDbService';
import { QueueOperation } from './models';

const app = express();
app.use(express.json());

app.listen(3000, async () => {
  const conn = await setupRethinkDb();

  const topic = 'yomamam';
  const alwaysFresh = true;

  const { producer, createConsumer } = await setupKafka({
    alwaysFresh,
    broker: 'localhost:9092',
    topic,
  });

  const queueOperationsRethinkDbService = new QueueOperationsRethinkDbService({
    conn: conn,
    db: 'test',
    table: 'queue',
  });

  if (alwaysFresh) {
    await queueOperationsRethinkDbService.removeTables();
    await queueOperationsRethinkDbService.createTables();
  }

  const queueOperations = new QueueOperationBrokerService({
    topic,
    producer,
  });

  app.use(
    '/admin',
    creatAdminRouter(queueOperations, queueOperationsRethinkDbService)
  );
  app.use('/customer', createCustomerRouter(queueOperations));

  const consumer = await createConsumer();
  consumer.on((event) => {
    switch (event.op) {
      case QueueOperation.JoinQueue: {
        queueOperationsRethinkDbService.onJoinQueue(event);
        break;
      }
      case QueueOperation.Next: {
        queueOperationsRethinkDbService.onNext(event);
        break;
      }
    }
  });
});
