export enum QueueStatus {
  Open = 'Open',
  Closed = 'Closed',
}

export enum QueueOperation {
  JoinQueue = 'JoinQueue',
  Serve = 'Serve',
}

export type QueueRow = {
  id: string;
  displayName: string;
  order: number;
  status: QueueStatus;
  queueId: string;
};

export type BaseQueueRequest = {
  queueId: string;
};

type BaseEvent<T extends QueueOperation> = BaseQueueRequest & { op: T };

export type ServeEvent = BaseEvent<QueueOperation.Serve> & {
  joinId: string;
};
export type JoinQueueEvent = BaseEvent<QueueOperation.JoinQueue> & {
  joinId: string;
};
export type QueueEvents = ServeEvent | JoinQueueEvent;
