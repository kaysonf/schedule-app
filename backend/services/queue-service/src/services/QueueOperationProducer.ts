import { Producer } from 'kafkajs';
import {
  JoinQueueEvent,
  ServeEvent,
  QueueEvents,
  QueueOperation,
} from '../models';
import { createLogger } from '../logger';
const logger = createLogger('QueueOperationKafkaProducer');
export interface IQueueOperationProducer {
  serve: (queueId: string, joinId: string) => Promise<ServeEvent>;
  joinQueue: (queueId: string) => Promise<JoinQueueEvent>;
}
export class QueueOperationKafkaProducer implements IQueueOperationProducer {
  private idGen = 0;
  private sequence = 0;
  constructor(
    private args: {
      topic: string;
      producer: Producer;
    }
  ) {}

  public async serve(queueId: string, joinId: string) {
    const event: ServeEvent = {
      queueId,
      op: QueueOperation.Serve,
      joinId,
    };

    this.sendToQueueTopic(event).catch(logger.error);

    return event;
  }

  public async joinQueue(queueId: string) {
    const joinId = `${queueId}-${++this.idGen}`;

    const event: JoinQueueEvent = {
      queueId,
      op: QueueOperation.JoinQueue,
      joinId,
      order: ++this.sequence,
    };

    this.sendToQueueTopic(event).catch(logger.error);

    return event;
  }

  private async sendToQueueTopic(payload: QueueEvents) {
    await this.args.producer.send({
      topic: this.args.topic,
      messages: [{ key: payload.queueId, value: JSON.stringify(payload) }],
    });
  }
}
