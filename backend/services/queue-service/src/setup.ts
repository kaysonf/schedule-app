import { Kafka } from 'kafkajs';
import { QueueEvents } from './models';
import * as r from 'rethinkdb';

export async function setupKafka(args: {
  reset: boolean;
  broker: string;
  topic: string;
}) {
  const kafka = new Kafka({
    brokers: [args.broker],
  });

  const admin = kafka.admin();
  await admin.connect();
  if (args.reset && (await topicExists())) {
    await admin.deleteTopics({
      topics: [args.topic],
    });
  }

  if (!(await topicExists())) {
    await admin.createTopics({
      topics: [{ topic: args.topic }],
    });
  }
  await admin.disconnect();

  const producer = kafka.producer();
  await producer.connect();

  return {
    producer,
    createConsumer: () => {
      const devOnlyGroupId = `[dev]-queue-service-${Math.random()}`;

      const consumer = kafka.consumer({ groupId: devOnlyGroupId });

      return {
        on: async (onQueueEvent: (event: QueueEvents) => void) => {
          await consumer.connect();

          await consumer.subscribe({
            topic: args.topic,
            fromBeginning: true,
          });

          await consumer.run({
            eachMessage: async (payload) => {
              const value = payload.message.value;
              if (value) {
                try {
                  const queueEvent = JSON.parse(value.toString());
                  onQueueEvent(queueEvent);
                } catch (e) {
                  console.error(e);
                }
              }
            },
          });
        },
        close: async () => {
          await consumer.disconnect();
        },
      };
    },
  };

  async function topicExists() {
    return (await admin.listTopics()).includes(args.topic);
  }
}

export async function setupRethinkDb(args: {
  host: string;
  port: number;
  reset: boolean;
  db: string;
  table: string;
}): Promise<r.Connection> {
  const connection = await r.connect({ host: args.host, port: args.port });

  if (connection) {
    if (args.reset && (await tableIsInDb())) {
      await r.db(args.db).tableDrop(args.table).run(connection);
    }

    if (!(await tableIsInDb())) {
      await r.db(args.db).tableCreate(args.table).run(connection);
    }
  }

  return connection;

  async function tableIsInDb() {
    return (await r.db(args.db).tableList().run(connection)).includes(
      args.table
    );
  }
}
