import {EventEmitter} from 'events';

import {CoinBaseDB} from '../coins/coinbase.db';
import {TransactionDB} from '../coins/transaction.db';
import {IPCMutex} from '../utils/ipc-mutex';
import {Logger} from '../utils/logger';

import {Block} from './block';
import {BlockDb} from './block.db';
import {BlockDocumentDeRefd} from './block.model';

const log = new Logger(`APP_CHAIN_${process.pid}`);
const lock = new IPCMutex('BlockWriterLock');

export class Chain extends EventEmitter {
  constructor() {
    super();

    this.init();
  }

  private init() {
    this.registerEvents();
  }

  start(): Promise<void> {
    return this.addGenesis();
  }

  // private addToChain(block: Block): Promise<InsertOneWriteOpResult> {
  //   return BlockDb.save(block);
  // }
  private addToChain(block: Block): Promise<void> {
    return BlockDb.saveWithTpc(block);
  }

  private async addGenesis(): Promise<void> {
    await lock.acquire();
    try {
      await this._addGenesis();
    } finally {
      lock.release();
    }
  }

  private async _addGenesis(): Promise<void> {
    try {
      if (await BlockDb.findGenesis() === null) {
        await this.addToChain(Block.genesis);
        log.a('Chain added genesis block to blockchain');
      }
    } catch (err) {
      log.e('Error saving genesis to database:\n%O', err);
    }
  }

  static getBlocks(): Promise<BlockDocumentDeRefd[]> {
    return BlockDb.getBlocks();
  }

  private async verify(block: Block): Promise<boolean> {
    if (await this.isDuplicate(block)) return false;
    if (!await this.hasParent(block)) return false;

    const verifyTxs = await Promise.all(
        block.transactions.map(tx => TransactionDB.verify(tx)));

    if (verifyTxs.some(el => el === false)) return false;
    if (!await CoinBaseDB.verify(block.coinbase)) return false;

    return true;
  }

  private isDuplicate(block: Block): Promise<boolean> {
    return BlockDb.exists(block);
  }

  private hasParent(block: Block): Promise<boolean> {
    return BlockDb.findPrevHeight(block).then(
        height => height === null ? false : true);
  }

  private async handleBlock(block: Block): Promise<void> {
    await lock.acquire();
    try {
      await this._handleBlock(block);
    } finally {
      lock.release();
    }
  }

  private async _handleBlock(block: Block): Promise<void> {
    try {
      if (await this.verify(block)) {
        await this.addToChain(block);
        log.d('Chain added block to database');
        this.emit('savedBlock', block);
      } else
        log.d('Block did not verify');
    } catch (err) {
      log.e('Error saving block to database:\n%O', err);
      this.emit('Error', block);
    }
  }

  private registerEvents(): void {
    this.on('Error', err => {
      log.e('Chain received an error:\n%O', err);
    });
    this.on('foreignBlock', (block: Block) => {
      log.d('Chain received block from P2pPool');
      this.handleBlock(block).catch((err) => {
        log.e('Error during handling of foreign block:\n%O', err);
      });
    });
    this.on('selfBlock', (block: Block) => {
      log.d('Chain received block from Miner');
      this.handleBlock(block).catch((err) => {
        log.e('Error during handling of self block:\n%O', err);
      });
    });
  }
}
