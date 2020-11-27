import cluster from 'cluster';

import {Mempool} from '../coins/mempool';
import {assertNever} from '../utils/error';
import {IPCMutex} from '../utils/ipc-mutex';
import {Logger} from '../utils/logger';

import {MempoolMessage, Message} from './message';
import {Parser} from './parser';
import {Synchronizer} from './synchronizer';

const log = new Logger(`APP_IPC_CONTROLLER_${process.pid}`);

export class Controller {
  constructor() {}

  static handle(msg: Message): void {
    log.d('IPC parser recived message: %O', msg);

    switch (msg.cmd) {
      case 'lock_req':
        IPCMutex.mAcquire(msg);
        break;
      case 'lock_rel':
        IPCMutex.mRelease(msg);
        break;
      case 'lock_conf':
        IPCMutex.wConfirm(msg);
        break;
      case 'tx_add':
        this.txAddMessage(msg);
        break;
      case 'tx_del':
        this.txDelMessage(msg);
        break;
      case 'sync_req':
        Synchronizer._request(msg);
        break;
      case 'sync_fin':
        Synchronizer._finished(msg);
        break;
      default:
        assertNever(msg, 'IPCMessageParser received unknown message type');
        break;
    }
  }

  private static txAddMessage(msg: MempoolMessage): void {
    if (cluster.isMaster)
      Synchronizer._relay(msg);
    else {
      const tx = Parser.txAddMessage(msg);
      Mempool.addIPCTx(tx);
    }
  }

  private static txDelMessage(msg: MempoolMessage): void {
    if (cluster.isMaster)
      Synchronizer._relay(msg);
    else {
      const txIds = Parser.txDelMessage(msg);
      Mempool.deleteIPCTx(txIds);
    }
  }
}
