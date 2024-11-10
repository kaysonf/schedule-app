import { AppConfig, createServer } from '../src/createServer';
import * as r from 'rethinkdb';
import { QueueRow } from '../src/models';

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

describe('queue-service test', () => {
  let app: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    app = await createServer(defaultTestConfig);
  });

  afterAll(async () => {
    await app.shutdown();
  });

  it('should queue', async () => {
    const res = await postData('http://localhost:3000/customer/queue', {
      queueId: 'ligma',
    });
    expect(res.status).toStrictEqual(200);

    const result = await r
      .db(defaultTestConfig.rethinkDb.db)
      .table(defaultTestConfig.rethinkDb.table)
      .filter(r.row('queueId').eq('ligma'))
      .changes()
      .run(app.conn);

    await waitForTest(1000, (done) => {
      result.each((err, row: { new_val: QueueRow }) => {
        const record = row.new_val;
        expect(record.order).toStrictEqual(0);
        expect(record.queueId).toStrictEqual('ligma');
        done();
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
