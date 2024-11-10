import { JoinQueueEvent, ServeEvent, QueueRow, QueueStatus } from '../models';
import { IQueueOperationsDb } from './queueOperationsDbService';

type QueueState = {
  order: number;
};
export class QueueOperationsStateMachine {
  private state: QueueState;

  constructor(private queueOperationsDb: IQueueOperationsDb) {
    this.state = {
      order: 0,
    };
  }

  public async onJoinQueue(event: JoinQueueEvent) {
    const queueRow: QueueRow = {
      id: event.joinId,
      displayName: event.joinId,
      order: this.state.order,
      status: QueueStatus.Open,
      queueId: event.queueId,
    };

    const success = await this.queueOperationsDb.onJoinQueue(queueRow);
    if (success) {
      this.state.order++;
    }
    return success;
  }

  public async onServe(event: ServeEvent) {
    return await this.queueOperationsDb.onServe(event.queueId, event.joinId);
  }
}
