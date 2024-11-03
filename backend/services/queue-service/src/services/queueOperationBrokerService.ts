import { Producer } from 'kafkajs';
import {
  JoinQueueEvent,
  NextEvent,
  QueueEvents,
  QueueOperation,
} from '../models';

export interface IQueueOperationBroker {
  next: (queueId: string) => Promise<NextEvent>;
  joinQueue: (queueId: string) => Promise<JoinQueueEvent>;
}
export class QueueOperationBrokerService implements IQueueOperationBroker {
  constructor(
    private args: {
      topic: string;
      producer: Producer;
    }
  ) {}

  public async next(queueId: string) {
    const event: NextEvent = {
      queueId,
      op: QueueOperation.Next,
    };

    await this.sendToQueueTopic(event);

    return event;
  }

  public async joinQueue(queueId: string) {
    const joinId = Math.random().toString();

    const event: JoinQueueEvent = {
      queueId,
      op: QueueOperation.JoinQueue,
      joinId,
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
