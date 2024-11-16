import { Socket } from 'socket.io';
import * as r from 'rethinkdb';
import { QueueRow, QueueStatus } from '../models';
import { logger } from '../logger';
import { waitForCondition } from '../../../../shared/asyncUtils';
type CleanupFn = () => void;

type QueryPayload = { queueId: string; limit?: number };

const orderIndexName = 'order';

export class RealTimeQueryService {
  private socketCleanups: CleanupFn[] = [];
  private indexCreation = waitForCondition('index creation');

  constructor(
    private table: string,
    private conn: r.Connection
  ) {
    this.createIndex().then(() => this.indexCreation.done());
  }

  public async addSocket(socket: Socket): Promise<void> {
    await this.indexCreation.condition(2000);

    const cleanupFns: CleanupFn[] = [];

    socket.on('query', async (jsonString) => {
      const msg = parseMessage<QueryPayload>(jsonString);
      const cleanup = await this.handleQuery(socket, msg);
      cleanupFns.push(cleanup);
    });

    const cleanupSocket = () => {
      while (cleanupFns.length > 0) {
        const cleanup = cleanupFns.shift();
        if (cleanup) {
          cleanup();
        }
      }
    };

    socket.on('disconnect', () => {
      logger.verbose(`${socket.id} disconnect`);
      cleanupSocket();
    });

    this.socketCleanups.push(cleanupSocket);
  }

  public cleanup() {
    while (this.socketCleanups.length > 0) {
      const cleanup = this.socketCleanups.shift();
      if (cleanup) {
        cleanup();
      }
    }
  }

  private async createIndex() {
    const indexList = new Set(
      await r.table(this.table).indexList().run(this.conn)
    );

    if (!indexList.has(orderIndexName)) {
      await r.table(this.table).indexCreate(orderIndexName).run(this.conn);
    }
  }

  private async handleQuery(socket: Socket, msg: QueryPayload) {
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

    const changeFeed = await querySequence
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
        logger.verbose(`${socket.id} ${JSON.stringify(result)}`);
        if (err) {
          // TODO should emit to user
          throw err;
        }

        const data = result.new_val;
        const msgData = data || result.old_val;
        socket.emit('query_result', {
          type: result.type,
          data: msgData,
        });
      }
    );

    return () => {
      logger.verbose(`${socket.id} closing changeFeed`);
      changeFeed.close();
    };
  }
}

function parseMessage<T>(jsonString: T | string): T {
  return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
}
