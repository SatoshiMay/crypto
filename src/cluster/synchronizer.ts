import assert from 'assert';
import cluster from 'cluster';
import uuid from 'uuid/v4';

import {Controller} from './controller';
import {Message, SyncMessage} from './message';

type resolver<T> = (value?: T|PromiseLike<T>) => void;

export class Synchronizer {
  private static _wSyncers: Map<string, resolver<void>> = new Map();
  private static _mSyncers:
      Map<string, {sourceWId: number, targetWIds: number[]}> = new Map();

  constructor() {}

  private static mSyncReq(sm: SyncMessage): void {
    const {wId, syncer} = sm;

    if (wId === undefined)
      throw new Error('Master received message without worker id');

    assert(!this._mSyncers.has(syncer));
    const ids: number[] = [];
    for (const id in cluster.workers)
      // @ts-ignore
      if (cluster.workers.hasOwnProperty(id) && +id !== wId) ids.push(+id);

    this._mSyncers.set(syncer, {sourceWId: wId, targetWIds: ids});

    // const m = new SyncMessage('sync_req', syncer, msg);
    // this._relay(m, wId);
    this._relay(sm);
  }

  private static mSyncFin(sm: SyncMessage): void {
    const {wId, syncer} = sm;

    if (wId === undefined)
      throw new Error('Master received message without worker id');

    const {sourceWId, targetWIds} = this._mSyncers.get(syncer)!;

    assert(targetWIds.indexOf(wId) > -1);
    const remaining = targetWIds.filter(t => t !== wId);

    if (remaining.length === 0) {
      const m = new SyncMessage('sync_fin', syncer);
      cluster.workers[sourceWId]!.send(m);
    } else
      this._mSyncers.set(syncer, {sourceWId, targetWIds: remaining});
  }

  private static async wSyncReq(sm: SyncMessage): Promise<void> {
    const {msg, syncer} = sm;

    if (msg === undefined)
      throw new Error('Worker received sync_req without msg');

    await Controller.handle(msg);
    const m = new SyncMessage('sync_fin', syncer);
    process.send!(m);
  }

  private static wSyncFin(sm: SyncMessage): void {
    const {syncer} = sm;
    const resolver = this._wSyncers.get(syncer)!;
    this._wSyncers.delete(syncer);
    resolver();
  }

  static _request(sm: SyncMessage): void {
    if (cluster.isMaster)
      this.mSyncReq(sm);
    else
      this.wSyncReq(sm);
  }

  static _finished(sm: SyncMessage): void {
    if (cluster.isMaster)
      this.mSyncFin(sm);
    else
      this.wSyncFin(sm);
  }

  static run(msg: Exclude<Message, SyncMessage>): Promise<void> {
    if (cluster.isMaster) return Promise.resolve();

    const syncer = uuid();
    const sm = new SyncMessage('sync_req', syncer, msg);

    return new Promise<void>((resolve, reject) => {
      this._wSyncers.set(syncer, resolve);
      process.send!(sm);
    });
  }

  static _relay(msg: Message): void {
    for (const id in cluster.workers)
      // @ts-ignore
      if (cluster.workers.hasOwnProperty(id) && +id !== msg.wId)
        cluster.workers[id]!.send(msg);
  }
}
