import assert from 'assert';
import {EventEmitter} from 'events';

import {Block, UnminedBlock} from '../blockchain/block';
import {BlockDb} from '../blockchain/block.db';
import {Transaction} from '../coins/transaction';
import {assertNever} from '../utils/error';
import {IPCMutex} from '../utils/ipc-mutex';
import {Logger, tree} from '../utils/logger';
import {Wallet} from '../wallet/wallet';

const log = new Logger(`APP_MINER_${process.pid}`);
const lock = new IPCMutex('MinerStarterLock');

export class Miner extends EventEmitter {
  private snapshot: Transaction[];
  private address: string;

  constructor(private readonly pending: Map<Buffer, Transaction>) {
    super();
    this.init().catch(err => log.e('Error initializing miner:\n%O', err));
  }

  private async init(): Promise<void> {
    this.registerEvents();
  }

  async start(): Promise<void> {
    await lock.acquire();
    try {
      const pubKey = await Wallet.getAddress('miner');
      if (pubKey)
        this.address = pubKey;
      else {
        const account = await Wallet.createAccount('miner');
        this.address = account.pubKey;
      }
      log.a('Miner obtained pubKey from Wallet: %s', this.address);
    } catch (err) {
      log.e('Error starting Miner:\n%O', err);
    } finally {
      lock.release();
    }
  }

  private mine(): void {
    assert(this.address, `Mining without address: ${this.address}`);

    if (this.pending)
      this.snapshot = Array.from(this.pending.values());
    else
      this.snapshot = [];

    Block.fromTransactions(this.snapshot, this.address)
        .then(unmined => this.solve(unmined))
        .then(block => this.emit('block', block))
        .catch(
            err => log.e(
                'Error mining block from transactions:\n%O\ntxs: %s', err,
                tree(this.snapshot)));
  }

  private async solve(block: UnminedBlock): Promise<Block> {
    const time = Math.floor(Date.now() / 1000);
    const nBits = 0;
    const nonce = 0;
    const prevDoc = await BlockDb.findHead();
    if (!prevDoc)
      return assertNever(
          prevDoc as never,
          `Miner could not locate prev document in solve ${tree(block)}`);
    const prevHash = prevDoc._id;
    const mined = block.fromMiner({time, nBits, nonce, prevHash});
    return mined;
  }

  private registerEvents(): void {
    this.on('mine', () => {
      log.d('Miner received mine event');
      this.mine();
    });
  }
}
