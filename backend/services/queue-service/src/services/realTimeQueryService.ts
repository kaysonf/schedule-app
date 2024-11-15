import { Socket } from 'socket.io';
import * as r from 'rethinkdb';
import { QueueRow, QueueStatus } from '../models';
import { logger } from '../logger';

type Handler<Msg> = {
  fn: (msg: Msg) => Promise<void>;
  cleanup: () => Promise<void>;
};
export class RealTimeQueryService {
  private cleanups: (() => Promise<void>)[] = [];

  constructor(
    private socket: Socket,
    private table: string,
    private conn: r.Connection
  ) {
    this.addHandler('query', this.createQueryHandler());

    socket.on('disconnect', () => {
      this.cleanup();
    });
  }

  public async cleanup() {
    if (this.socket.connected) {
      this.socket.disconnect();
    }

    for (const cleanup of this.cleanups) {
      await cleanup();
    }
    this.cleanups = [];
  }

  private addHandler<Msg>(event: string, handler: Handler<Msg>) {
    this.socket.on(event, async (jsonString) => {
      let msg = jsonString;
      if (typeof jsonString === 'string') {
        // TODO remove
        msg = JSON.parse(jsonString);
      }

      await handler.fn(msg);
    });
    this.cleanups.push(handler.cleanup);
  }

  private createQueryHandler(): Handler<{ queueId: string; limit?: number }> {
    let sowCursor: r.Cursor;
    let changeFeed: r.Cursor;

    const orderIndexName = 'order';

    return {
      fn: async (msg) => {
        const indexList = new Set(
          await r.table(this.table).indexList().run(this.conn)
        );

        if (!indexList.has(orderIndexName)) {
          await r.table(this.table).indexCreate(orderIndexName).run(this.conn);
        }

        const defaultLimit = 30;
        const maxLimit = 50;
        const limit = Math.min(msg.limit ?? defaultLimit, maxLimit);

        const querySequence = r
          .table(this.table)
          .orderBy({ index: orderIndexName })
          .limit(limit)
          .filter({
            queueId: msg.queueId,
            status: QueueStatus.Open,
          } satisfies Partial<QueueRow>);

        changeFeed = await querySequence
          .changes({
            includeInitial: true,
            includeOffsets: false,
            changefeedQueueSize: 100_000,
            includeStates: false,
            includeTypes: true,
            squash: true,
          })
          .run(this.conn);

        changeFeed.each(
          (
            err,
            result: {
              new_val: QueueRow | null;
              old_val: QueueRow | null;
              type: string;
            }
          ) => {
            logger.info(`${JSON.stringify(result)}`);
            if (err) {
              // TODO should emit to user
              throw err;
            }

            const data = result.new_val;
            const msgData = data || result.old_val;
            this.socket.emit('query_result', {
              type: result.type,
              data: msgData,
            });
          }
        );
      },
      cleanup: async () => {
        if (sowCursor) {
          await sowCursor.close();
        }

        if (changeFeed) {
          await changeFeed.close();
        }
      },
    };
  }
}
