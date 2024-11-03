import { Kafka } from 'kafkajs';
import { QueueEvents } from './models';
import * as r from 'rethinkdb';
export async function setupKafka(args: {
  alwaysFresh: boolean;
  broker: string;
  topic: string;
}) {
  const kafka = new Kafka({
    brokers: ['localhost:9092'],
  });

  const admin = kafka.admin();
  await admin.connect();
  const topicsList = await admin.listTopics();
  const topics = new Set(topicsList);

  if (args.alwaysFresh && topics.has(args.topic)) {
    await admin.deleteTopics({
      topics: [args.topic],
    });

    topics.delete(args.topic);
  }

  if (!topics.has(args.topic)) {
    await admin.createTopics({
      topics: [{ topic: args.topic }],
    });
  }

  const producer = kafka.producer();
  await producer.connect();

  return {
    producer,
    createConsumer: async () => {
      const devOnlyGroupId = `[dev]-queue-service-${Math.random()}`;

      const consumer = kafka.consumer({ groupId: devOnlyGroupId });
      await consumer.connect();

      await consumer.subscribe({
        topic: args.topic,
        fromBeginning: true,
      });

      return {
        on: (onQueueEvent: (event: QueueEvents) => void) => {
          consumer.run({
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
      };
    },
  };
}

export async function setupRethinkDb(): Promise<r.Connection> {
  return new Promise<r.Connection>((resolve, reject) => {
    r.connect({ host: 'localhost', port: 28015 }, async (err, conn) => {
      if (err) {
        reject(err);
      }
      resolve(conn);
    });
  });
}
