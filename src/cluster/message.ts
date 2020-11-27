import cluster from 'cluster';

import {Transaction} from '../coins/transaction';

const _id: number|undefined = cluster.isWorker ? cluster.worker.id : undefined;

export type Message = MutexMessage|MempoolMessage|SyncMessage;

export class MutexMessage {
  readonly lockName: string;
  readonly cmd: 'lock_req'|'lock_rel'|'lock_conf';
  readonly wId?: number;

  constructor(lockName: string, cmd: 'lock_req'|'lock_rel'|'lock_conf') {
    this.lockName = lockName;
    this.cmd = cmd;
    if (_id) this.wId = _id;
  }
}

export class MempoolMessage {
  readonly cmd: 'tx_add'|'tx_del';
  readonly wId?: number;
  readonly data: string;

  constructor(cmd: 'tx_add', tx: Transaction);
  constructor(cmd: 'tx_del', txIds: Buffer[]);
  constructor(cmd: 'tx_add'|'tx_del', x: Transaction|Buffer[]) {
    this.cmd = cmd;
    if (_id) this.wId = _id!;
    if (x instanceof Transaction)
      this.data = x.JSON();
    else
      this.data = JSON.stringify(x);
  }
}

export class SyncMessage {
  readonly cmd: 'sync_req'|'sync_fin';
  readonly syncer: string;
  readonly wId: number|undefined;
  readonly msg?: Exclude<Message, SyncMessage>;

  constructor(
      cmd: 'sync_req'|'sync_fin', syncer: string,
      msg?: Exclude<Message, SyncMessage>) {
    this.cmd = cmd;
    this.syncer = syncer;
    if (_id) this.wId = _id!;
    if (msg) this.msg = msg;
  }
}
