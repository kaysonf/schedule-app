import { AppConfig, createServer } from '../src/createServer';
import { QueueRow } from '../src/models';
import { io, Socket } from 'socket.io-client';
import { waitForCondition } from '../../../shared/asyncUtils';
import { logLevel } from 'kafkajs';

const reset = true;

const testConfig: AppConfig = {
  logLevel: 'verbose',
  express: {
    port: 7171,
  },
  socketIo: {
    port: 7172,
  },
  rethinkDb: {
    db: 'test',
    table: 'e2e-queue',
    host: 'localhost',
    port: 28015,
    reset,
  },
  kafka: {
    broker: 'localhost:9092',
    topic: 'e2e-queue-topic',
    logLevel: logLevel.NOTHING,
    consumerGroupId: `[e2e]-queue-service-${Math.random()}`,
    clientId: 'e2e-queue-service',
    reset,
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
  const uniqueCustomers = new Set<string>();
  const queueId = 'ligma';

  beforeAll(async () => {
    const { done, condition: clientConnected } = waitForCondition();
    app = await createServer(testConfig);

    client = io(`http://localhost:${testConfig.socketIo.port}`);
    client.on('connect', () => done());

    await clientConnected(1000);
    client.emit('query', { queueId, limit: 50 });
  });

  afterEach(() => {
    client.removeAllListeners('query_result');
  });

  afterAll(async () => {
    client.disconnect();
    await app.shutdown();
  });

  it('1. should allow the admin to observe the queue as customers join', async () => {
    const { done, condition } = waitForCondition('data loaded');

    client.on('query_result', (msg: { data: QueueRow; type: string }) => {
      uniqueCustomers.add(msg.data.id);
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

    await Promise.all(customers);

    await condition(500);
    expect(uniqueCustomers.size).toStrictEqual(customers.length);
  });

  it('2. should allow the admin to serve customers and observe the result', (done) => {
    const customerId = uniqueCustomers.values().next().value as string;

    client.on('query_result', (msg: { data: QueueRow; type: string }) => {
      expect(msg.type).toStrictEqual('remove');
      expect(msg.data.id).toStrictEqual(customerId);
      done();
    });

    serve(queueId, customerId);
  });
});
