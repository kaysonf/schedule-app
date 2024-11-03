import { JoinQueueEvent, NextEvent, QueueRow, QueueStatus } from '../models';
import * as r from 'rethinkdb';

export interface IQueueOperationsDb {
  onNext: (event: NextEvent) => Promise<void>;
  onJoinQueue: (event: JoinQueueEvent) => Promise<void>;
  getQueueMeta: (queueId: string) => Promise<QueueMeta | undefined>;
}

function queueRow(data: Partial<QueueRow>) {
  return data;
}

function row(prop: keyof QueueRow) {
  return r.row(prop);
}

type QueueMeta = {
  startOfQueue: number;
  endOfQueue: number;
};
export class QueueOperationsRethinkDbService implements IQueueOperationsDb {
  private queues: Map<string, QueueMeta>;

  constructor(
    private args: {
      conn: r.Connection;
      db: string;
      table: string;
    }
  ) {
    this.queues = new Map();
  }
  public async onJoinQueue(event: JoinQueueEvent) {
    const meta = await this.getQueueMeta(event.queueId);

    const queueRow: QueueRow = {
      id: event.joinId,
      displayName: event.joinId,
      order: meta.endOfQueue,
      status: QueueStatus.Open,
      queueId: event.queueId,
    };

    await r.table(this.args.table).insert(queueRow).run(this.args.conn);

    meta.endOfQueue += 1;
    this.queues.set(event.queueId, meta);
  }

  public async onNext(event: NextEvent) {
    const forQueueId = row('queueId').eq(event.queueId);
    const isOpenStatus = row('status').eq(QueueStatus.Open);
    const meta = await this.getQueueMeta(event.queueId);
    const isNextInQueue = () => {
      return row('order').lt(meta.startOfQueue + 1); // lte
    };

    const result = await r
      .table(this.args.table)
      .filter(forQueueId.and(isOpenStatus).and(isNextInQueue()))
      .limit(1)
      .update(
        queueRow({
          status: QueueStatus.Closed,
        })
      )
      .run(this.args.conn);

    if (result.replaced > 0) {
      meta.startOfQueue += 1;
      this.queues.set(event.queueId, meta);
    }
  }

  public async getQueueMeta(queueId: string) {
    const queueMeta = this.queues.get(queueId) || {
      startOfQueue: 0,
      endOfQueue: 0,
    };

    return {
      ...queueMeta,
    };
  }

  public async removeTables() {
    try {
      await r.db(this.args.db).tableDrop(this.args.table).run(this.args.conn);
    } catch (e) {
      console.error(e);
    }
  }

  public async createTables() {
    try {
      await r.db(this.args.db).tableCreate(this.args.table).run(this.args.conn);
    } catch (e) {
      console.error(e);
    }
  }
}
