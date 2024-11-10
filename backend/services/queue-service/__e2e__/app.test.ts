import { AppConfig, createServer } from '../src/createServer';
import * as r from 'rethinkdb';

const defaultTestConfig: AppConfig = {
  express: {
    port: 3000,
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
      method: 'POST', // Specify the HTTP method
      headers: {
        'Content-Type': 'application/json', // Specify content type as JSON
      },
      body: JSON.stringify(data), // Convert the data to a JSON string
    });
  } catch (error) {
    console.error('Error in postData:', error);
    throw error;
  }
}

async function queue(id: string) {
  await postData('http://localhost:3000/customer/queue', {
    queueId: id,
  });
}

describe('queue-service test', () => {
  let app: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    app = await createServer(defaultTestConfig);
  });

  afterAll(async () => {
    await app.shutdown();
  });

  it('should queue', async () => {
    const queueId = 'ligma';

    const queues = await Promise.all([
      queue(queueId),
      queue(queueId),
      queue(queueId),
    ]);

    const cursor = await r
      .db(defaultTestConfig.rethinkDb.db)
      .table(defaultTestConfig.rethinkDb.table)
      .filter(r.row('queueId').eq(queueId))
      .changes()
      .run(app.conn);

    await waitForTest(200, (done) => {
      let counter = 0;

      cursor.each((err) => {
        if (err) {
          throw err;
        }
        counter++;
        if (counter === queues.length) {
          done();
        }
      });
    });
  });
});

function waitForTest(ms: number, testFn: (done: () => void) => void) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(`assertion failed to run within ${ms} ms`);
    }, ms);
    testFn(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}
