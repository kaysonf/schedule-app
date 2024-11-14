import { Producer } from 'kafkajs';
import {
  JoinQueueEvent,
  ServeEvent,
  QueueEvents,
  QueueOperation,
} from '../models';

export interface IQueueOperationBroker {
  serve: (queueId: string, joinId: string) => Promise<ServeEvent>;
  joinQueue: (queueId: string) => Promise<JoinQueueEvent>;
}
export class QueueOperationKafkaBrokerService implements IQueueOperationBroker {
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

    await this.sendToQueueTopic(event);

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

    await this.sendToQueueTopic(event);

    return event;
  }

  private async sendToQueueTopic(payload: QueueEvents) {
    await this.args.producer.send({
      topic: this.args.topic,
      messages: [{ key: payload.queueId, value: JSON.stringify(payload) }],
    });
  }
}
