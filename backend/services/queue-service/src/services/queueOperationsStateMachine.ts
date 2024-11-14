import { JoinQueueEvent, ServeEvent, QueueRow, QueueStatus } from '../models';
import { IQueueOperationsDb } from './queueOperationsDbService';

export class QueueOperationsStateMachine {
  constructor(private queueOperationsDb: IQueueOperationsDb) {}

  public async onJoinQueue(event: JoinQueueEvent) {
    const queueRow: QueueRow = {
      id: event.joinId,
      displayName: event.joinId,
      order: event.order,
      status: QueueStatus.Open,
      queueId: event.queueId,
    };

    return await this.queueOperationsDb.onJoinQueue(queueRow);
  }

  public async onServe(event: ServeEvent) {
    return await this.queueOperationsDb.onServe(event.queueId, event.joinId);
  }
}
