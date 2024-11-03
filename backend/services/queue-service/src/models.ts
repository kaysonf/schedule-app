export enum QueueStatus {
  Open = 'Open',
  Closed = 'Closed',
}

export enum QueueOperation {
  JoinQueue = 'JoinQueue',
  Next = 'Next',
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

export type NextEvent = BaseEvent<QueueOperation.Next>;
export type JoinQueueEvent = BaseEvent<QueueOperation.JoinQueue> & {
  joinId: string;
};
export type QueueEvents = NextEvent | JoinQueueEvent;
