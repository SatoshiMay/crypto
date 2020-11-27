import cluster from 'cluster';

import {MutexMessage} from '../cluster/message';

import {Mutex, resolver} from './mutex';

export class IPCMutex extends Mutex {
  private static _waiters: Map<string, number[]> = new Map();
  private static _locked: Map<string, boolean> = new Map();
  private static _resolvers: Map<string, Array<resolver<void>>> = new Map();
  private readonly lockName: string;

  constructor(name: string) {
    super();
    this.lockName = name;
  }

  acquire(): Promise<void> {
    if (cluster.isMaster) return super.acquire();

    const msg = new MutexMessage(this.lockName, 'lock_req');
    process.send!(msg);

    return new Promise<void>(resolve => {
      const resolvers = IPCMutex._resolvers.get(this.lockName);
      if (resolvers === undefined)
        IPCMutex._resolvers.set(this.lockName, [resolve]);
      else
        IPCMutex._resolvers.set(this.lockName, [...resolvers, resolve]);
    });
  }

  release(): void {
    if (cluster.isMaster) return super.release();

    const msg = new MutexMessage(this.lockName, 'lock_rel');
    process.send!(msg);
  }

  static wConfirm(data: MutexMessage): void {
    const {lockName} = data;
    const resolver = IPCMutex._resolvers.get(lockName)!.shift()!;
    resolver();
  }

  static mAcquire(data: MutexMessage): void {
    const {lockName, wId} = data;
    if (wId === undefined)
      throw new Error('Master received message without worker id');

    if (!this.isLocked(lockName)) {
      this._locked.set(lockName, true);
      this.sendConfirmation(lockName, wId);
    } else
      this.addToWaiters(lockName, wId);
  }

  static mRelease(data: MutexMessage): void {
    const {lockName} = data;

    if (this.noneWaiting(lockName))
      this._locked.set(lockName, false);
    else {
      const wId = this.popWaiter(lockName);
      this.sendConfirmation(lockName, wId);
    }
  }

  private static isLocked(lockName: string): boolean {
    return this._locked.get(lockName) !== undefined &&
        this._locked.get(lockName)!;
  }

  private static sendConfirmation(lockName: string, wId: number): void {
    const msg = new MutexMessage(lockName, 'lock_conf');
    cluster.workers[wId]!.send(msg);
  }

  private static addToWaiters(lockName: string, wId: number): void {
    const waiters = this._waiters.get(lockName);
    if (waiters === undefined)
      this._waiters.set(lockName, [wId]);
    else
      this._waiters.set(lockName, [...waiters, wId]);
  }

  private static noneWaiting(lockName: string): boolean {
    const waiters = this._waiters.get(lockName);
    return waiters === undefined || waiters.length === 0;
  }

  private static popWaiter(lockName: string): number {
    return this._waiters.get(lockName)!.shift()!;
  }
}
