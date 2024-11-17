import { createServer } from './createServer';

const reset = true;

createServer({
  express: {
    port: 8081,
  },
  socketIo: {
    port: 8082,
  },
  rethinkDb: {
    reset,
    db: 'test',
    table: 'queue',
    host: 'localhost',
    port: 28015,
  },
  kafka: {
    reset,
    broker: 'localhost:9092',
    topic: 'yomamam',
    consumerGroupId: `[e2e]-queue-service-${Math.random()}`,
    clientId: 'queue-service',
  },
});
