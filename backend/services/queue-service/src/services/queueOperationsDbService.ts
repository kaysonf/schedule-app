import { QueueRow, QueueStatus } from '../models';
import * as r from 'rethinkdb';

export interface IQueueOperationsDb {
  onServe: (queueId: string, joinId: string) => Promise<boolean>;
  onJoinQueue: (row: QueueRow) => Promise<boolean>;
}

function queueRow(data: Partial<QueueRow>) {
  return data;
}

function row(prop: keyof QueueRow) {
  return r.row(prop);
}

export class QueueOperationsRethinkDbService implements IQueueOperationsDb {
  constructor(
    private args: {
      conn: r.Connection;
      table: string;
    }
  ) {}
  public async onJoinQueue(row: QueueRow) {
    const result = await r
      .table(this.args.table)
      .insert(row)
      .run(this.args.conn);

    return result.inserted > 0;
  }

  public async onServe(queueId: string, joinId: string) {
    const forQueueId = row('queueId').eq(queueId);
    const isJoinId = () => {
      return row('id').eq(joinId);
    };

    const result = await r
      .table(this.args.table)
      .filter(forQueueId.and(isJoinId()))
      .update(
        queueRow({
          status: QueueStatus.Closed,
        })
      )
      .run(this.args.conn);

    return result.replaced > 0;
  }
}
