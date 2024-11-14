import { AppConfig, createServer } from '../src/createServer';
import { QueueRow } from '../src/models';
import { io, Socket } from 'socket.io-client';
import { waitForCondition } from '../../../shared/asyncUtils';

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

describe('queue-service test', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let client: Socket;

  const totalCustomers = 50;
  const customersInQueue: QueueRow[] = [];
  const queueId = 'ligma';

  beforeAll(async () => {
    const { done, condition: clientConnected } = waitForCondition();
    app = await createServer(testConfig);

    client = io(`http://localhost:${testConfig.socketIo.port}`);
    client.on('connect', done);

    await clientConnected(1000);
  });

  afterAll(async () => {
    client.disconnect();
    await app.shutdown();
  });

  it('should queue', async () => {
    const { done, condition } = waitForCondition();

    client.on('query_result', (row: { new_val: QueueRow }) => {
      customersInQueue.push(row.new_val);
      if (customersInQueue.length === totalCustomers) {
        done();
      }
    });
    client.emit('query', { queueId });

    const customers: Promise<void>[] = [];

    for (let i = 0; i < totalCustomers; i++) {
      customers.push(queue(queueId));
    }

    await Promise.all(customers);

    await condition(1000);
    expect(customersInQueue.length).toStrictEqual(customers.length);

    const uniqueOrdering = customersInQueue.reduce((ordering, curr) => {
      ordering.add(curr.order);
      return ordering;
    }, new Set<number>());

    expect(uniqueOrdering.size).toStrictEqual(customers.length);
  });

  // it('can serve', async () => {
  //
  // });
});
