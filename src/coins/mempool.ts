import assert from 'assert';
import {EventEmitter} from 'events';

import {Block} from '../blockchain/block';
import {MempoolMessage} from '../cluster/message';
import {Synchronizer} from '../cluster/synchronizer';
import {IPCMutex} from '../utils/ipc-mutex';
import {Logger} from '../utils/logger';

import {Transaction} from './transaction';
import {TransactionDB} from './transaction.db';

const log = new Logger(`APP_MEMPOOL_${process.pid}`);
const lock = new IPCMutex('TxWriterLock');

export class Mempool extends EventEmitter {
  static readonly pending: Map<Buffer, Transaction> = new Map();

  constructor() {
    super();

    // this._pending = new Map();
    this.init();
  }

  static get txIds(): string[] {
    return Array.from(this.pending.keys()).map(buf => buf.toString('hex'));
  }

  private init(): void {
    this.registerEvents();
  }

  // state store - start
  static addIPCTx(tx: Transaction): void {
    this.pending.set(tx.id, tx);
  }

  static deleteIPCTx(txIds: Buffer[]): void {
    txIds.forEach(txId => this.delete(txId));
  }

  private async _handleTx(tx: Transaction): Promise<boolean> {
    if (await this.verify(tx)) {
      Mempool.pending.set(tx.id, tx);
      await this.syncCluster('tx_add', tx);
      return true;
    } else
      return false;
  }

  private async _handleBlock(block: Block): Promise<void> {
    const deletions: Buffer[] = [];
    for (const tx of block.transactions) {
      const deleted = Mempool.delete(tx.id);
      if (deleted) deletions.push(tx.id);
    }
    await this.syncCluster('tx_del', deletions);
  }
  // state store - end

  private static delete(txId: Buffer): boolean {
    let pending = false;
    for (const id of Mempool.pending.keys())
      if (id.equals(txId)) {
        Mempool.pending.delete(id);
        pending = true;
      }
    return pending;
  }

  private async verify(tx: Transaction): Promise<boolean> {
    if (!this.verifySync(tx)) return false;

    const result = await this.verifyAsync(tx);
    if (!result) return false;

    return true;
  }

  private verifySync(tx: Transaction): boolean {
    if (this.isPending(tx))
      return false;
    else if (this.isSelfDouble(tx))
      return false;
    else if (!this.isUnspentSync(tx))
      return false;
    else
      return true;
  }

  private async verifyAsync(tx: Transaction): Promise<boolean> {
    return TransactionDB.verify(tx);
  }

  private isSelfDouble(tx: Transaction): boolean {
    const prevOuts = tx.inputs.map(input => input.prevOut);
    let i = prevOuts.length, j, eli, elj;
    while (i--) {
      eli = prevOuts[i];
      j = i;
      while (j--) {
        elj = prevOuts[j];
        if (elj.hash.equals(eli.hash) && elj.outNum === eli.outNum) return true;
      }
    }
    return false;
  }

  private isPending(tx: Transaction): boolean {
    for (const txid of Mempool.pending.keys())
      if (txid.equals(tx.id)) return true;

    return false;
  }

  private isUnspentSync(tx: Transaction): boolean {
    let i, j, prevOuts, eli, elj;
    for (const pending of Mempool.pending.values()) {
      prevOuts = pending.inputs.map(input => input.prevOut);
      i = prevOuts.length;
      while (i--) {
        eli = prevOuts[i];
        j = tx.inputs.length;
        while (j--) {
          elj = tx.inputs[j].prevOut;
          if (elj.hash.equals(eli.hash) && elj.outNum === eli.outNum)
            return false;
        }
      }
    }
    return true;
  }

  private async handleTx(tx: Transaction): Promise<boolean> {
    let result: boolean;
    await lock.acquire();
    try {
      result = await this._handleTx(tx);
    } finally {
      lock.release();
    }
    return result;
  }

  private async handleBlock(block: Block): Promise<void> {
    await lock.acquire();
    try {
      await this._handleBlock(block);
    } finally {
      lock.release();
    }
  }

  private syncCluster(cmd: 'tx_add', x: Transaction): Promise<void>;
  private syncCluster(cmd: 'tx_del', x: Buffer[]): Promise<void>;
  private syncCluster(cmd: any, x: any): Promise<void> {
    if (x instanceof Array && x.length === 0) return Promise.resolve();

    const msg = new MempoolMessage(cmd, x);
    return Synchronizer.run(msg);
  }

  private registerEvents(): void {
    this.on('selfTx', (tx: Transaction) => {
      log.d('Mempool received transaction from Wallet');
      this.handleTx(tx).catch(err => {
        log.e('Error during handling of incoming transaction:\n%O', err);
      });
    });

    this.on('foreignTx', (tx: Transaction) => {
      log.d('Mempool received transaction from Network');
      this.handleTx(tx)
          .then((verified: boolean) => {
            if (verified) this.emit('verifiedTx');
          })
          .catch(err => {
            log.e('Error during handling of incoming transaction:\n%O', err);
          });
    });

    this.on('block', (block: Block) => {
      log.d('Mempool received block from either Miner or Network');
      try {
        this.handleBlock(block);
      } catch (err) {
        log.e('Error during handling of block from miner:\n%O', err);
      }
    });
  }
}
