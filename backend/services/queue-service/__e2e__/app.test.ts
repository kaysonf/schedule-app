import { AppConfig, createServer } from '../src/createServer';
import { QueueRow } from '../src/models';
import { io, Socket } from 'socket.io-client';
import { waitForCondition } from '../../../shared/asyncUtils';
import { logLevel } from 'kafkajs';

const testConfig: AppConfig = {
  express: {
    port: 3000,
  },
  socketIo: {
    port: 3001,
  },
  reset: true,
  rethinkDb: {
    db: 'test',
    table: 'e2e-queue',
    host: 'localhost',
    port: 28015,
  },
  kafka: {
    broker: 'localhost:9092',
    topic: 'e2e-queue-topic',
    logLevel: logLevel.NOTHING,
  },
};

async function postData<T>(url: string, data: T) {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Error in postData:', error);
    throw error;
  }
}

async function queue(id: string) {
  await postData(`http://localhost:${testConfig.express.port}/customer/queue`, {
    queueId: id,
  });
}

async function serve(queueId: string, joinId: string) {
  await postData(`http://localhost:${testConfig.express.port}/admin/serve`, {
    queueId,
    joinId,
  });
}

describe('queue-service base workflow', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let client: Socket;

  const totalCustomers = 50;
  const uniqueCustomers = new Map<string, QueueRow>();
  const queueId = 'ligma';

  beforeAll(async () => {
    const { done, condition: clientConnected } = waitForCondition();
    app = await createServer(testConfig);

    client = io(`http://localhost:${testConfig.socketIo.port}`);
    client.on('connect', done);

    await clientConnected(1000);
  });

  afterEach(() => {
    client.removeAllListeners();
  });

  afterAll(async () => {
    client.disconnect();
    await app.shutdown();
  });

  it('should allow the admin to observe the queue as customers join', async () => {
    const { done, condition } = waitForCondition('data loaded');

    client.on('query_result', (msg: { data: QueueRow; type: string }) => {
      uniqueCustomers.set(msg.data.id, msg.data);
      if (uniqueCustomers.size > totalCustomers) {
        throw Error('impossible');
      }

      expect(msg.type).not.toStrictEqual('remove');

      if (uniqueCustomers.size === totalCustomers) {
        setTimeout(done, 100);
      }
    });

    const customers: Promise<void>[] = [];

    for (let i = 0; i < totalCustomers; i++) {
      customers.push(queue(queueId));
    }

    // await to simulate "race" conditions, since a response from the server does not mean that data is written yet
    await Promise.all(customers);
    client.emit('query', { queueId, limit: 50 });

    await condition(500);
    expect(uniqueCustomers.size).toStrictEqual(customers.length);
  });

  it('should allow the admin to observe customers being served', (done) => {
    const customer = uniqueCustomers.values().next().value as QueueRow;

    client.on('query_result', (msg: { data: QueueRow; type: string }) => {
      expect(msg.type).toStrictEqual('remove');
      expect(msg.data.id).toStrictEqual(customer.id);
      done();
    });

    serve(customer.queueId, customer.id);
  });
});
