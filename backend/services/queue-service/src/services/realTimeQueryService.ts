import { Socket } from 'socket.io';
import * as r from 'rethinkdb';
import { QueueRow } from '../models';

function row(prop: keyof QueueRow) {
  return r.row(prop);
}

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

  private createQueryHandler(): Handler<{ queueId: string }> {
    let cursor: r.Cursor;

    return {
      fn: async (msg) => {
        cursor = await r
          .table(this.table)
          .filter(row('queueId').eq(msg.queueId))
          .changes()
          .run(this.conn);

        cursor.each((err, result) => {
          if (err) {
            // TODO should emit to user
            throw err;
          }
          this.socket.emit('query_result', result);
        });
      },
      cleanup: async () => {
        if (cursor) {
          await cursor.close();
        }
      },
    };
  }
}
