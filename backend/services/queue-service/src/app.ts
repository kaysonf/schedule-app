import { createServer } from './createServer';
import { logger } from './logger';

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
}).catch(logger.error);
