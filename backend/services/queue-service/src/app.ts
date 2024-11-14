import { createServer } from './createServer';

createServer({
  express: {
    port: 3000,
  },
  socketIo: {
    port: 3001,
  },
  reset: true,
  rethinkDb: {
    db: 'test',
    table: 'queue',
    host: 'localhost',
    port: 28015,
  },
  kafka: {
    broker: 'localhost:9092',
    topic: 'yomamam',
  },
}).catch(console.error);
