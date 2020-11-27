import {CoinBase, CoinBaseData} from '../coins/coinbase';
import {CoinBaseDB} from '../coins/coinbase.db';
import {Transaction, TransactionData} from '../coins/transaction';
import {TransactionDB} from '../coins/transaction.db';
import * as CONSTANTS from '../constants';
import {BufReader, BufWriter} from '../utils/buf-read-write';
import {hashx2} from '../utils/hashx2';
import {Logger} from '../utils/logger';
import {NonFunctionProperties, Omit} from '../utils/type-mappings';

import {BlockHeader} from './blockheader';

const log = new Logger(`APP_BLOCK_${process.pid}`);

export class Block extends BlockHeader {
  count: number;  // including coinbase
  coinbase: CoinBase;
  transactions: Transaction[];
  private _id: Buffer;

  constructor() {
    super();
  }

  get id(): Buffer {
    return this._id;
  }

  static get genesis(): Block {
    return Block.fromData(_genesis);
  }

  static fromData(data: BlockData): Block {
    const block = new this();

    Object.assign(block, data);
    block.coinbase = CoinBase.fromData(data.coinbase);
    block.transactions = data.transactions.map(t => Transaction.fromData(t));
    block._id = hashx2(block.serializeHeader());

    return block;
  }

  static async fromTransactions(txs: Transaction[], address: string):
      Promise<UnminedBlock> {
    const totalOut = Transaction.getOutputSum(txs);

    const [sumFromTxs, sumFromCBs] = await Promise.all(
        [TransactionDB.getInputSum(txs), CoinBaseDB.getInputSum(txs)]);
    const totalIn = sumFromTxs + sumFromCBs;

    const fee = totalIn - totalOut;

    const coinbase = await CoinBase.fromOutput({
      value: CONSTANTS.BLOCK_SUBSIDY * CONSTANTS.SATOSHI_IN_BTC + fee,
      scriptLength: address.length,
      script: address
    });

    const block: UnminedBlock = new this();
    block.version = CONSTANTS.BLOCK_VERSION;
    block.count = txs.length + 1;
    block.coinbase = coinbase;
    block.transactions = txs;
    block.merkleRoot = this.merkleRoot([coinbase, ...txs]);
    return block;
  }

  fromMiner(solution:
                {time: number, nBits: number, nonce: number, prevHash: Buffer}):
      Block {
    this.time = solution.time;
    this.nBits = solution.nBits;
    this.nonce = solution.nonce;
    this.prevHash = solution.prevHash;
    this._id = hashx2(super.serialize());
    return this;
  }

  private static merkleRoot(arr: Buffer[]): Buffer;
  private static merkleRoot(arr: Array<CoinBase|Transaction>): Buffer;
  private static merkleRoot(arr: Array<CoinBase|Transaction|Buffer>): Buffer {
    if (arr.length === 1)
      if (arr[0] instanceof Buffer)
        return arr[0] as Buffer;
      else  // got CoinBase
        return (arr[0] as CoinBase).id;

    if ((arr.length % 2) === 1) arr.push(arr[arr.length - 1]);

    const decimate: Buffer[] = [];
    for (let i = 0, len = arr.length; i < len - 1; i = i + 2)
      if (arr[0] instanceof Buffer)  // got array of buffers
        decimate.push(hashx2(
            Buffer.concat([arr[i] as Buffer, arr[i + 1] as Buffer], 64)));
      else
        decimate.push(hashx2(Buffer.concat(
            [
              (arr[i] as CoinBase | Transaction).id,
              (arr[i + 1] as CoinBase | Transaction).id
            ],
            64)));

    return this.merkleRoot(decimate);
  }

  static deserialize(reader: BufReader): BlockData;
  static deserialize(buf: Buffer): BlockData;
  static deserialize(x: Buffer|BufReader): BlockData {
    let br: BufReader;
    if (x instanceof Buffer)
      br = new BufReader(x);
    else
      br = x;

    const {version, prevHash, merkleRoot, time, nBits, nonce} =
        super.deserialize(br);

    const count = br.readVarInt();

    const coinbase = CoinBase.deserialize(br);

    const transactions: TransactionData[] = [];
    for (let index = 0; index < count - 1; index++)
      transactions.push(Transaction.deserialize(br));

    return {
      version,
      prevHash,
      merkleRoot,
      time,
      nBits,
      nonce,
      count,
      coinbase,
      transactions
    };
  }

  serializeHeader(): Buffer {
    return super.serialize();
  }

  serialize(): Buffer {
    const bw = new BufWriter();

    bw.writeBuffer(super.serialize());

    bw.writeVarInt(this.count);

    bw.writeBuffer(this.coinbase.serialize());

    for (let index = 0; index < this.count - 1; index++)
      bw.writeBuffer(this.transactions[index].serialize());

    return bw.buffer;
  }
}

// tslint:disable-next-line:variable-name
const _genesis_coinbase: CoinBaseData = {
  version: 1,
  numInput: 1,
  input: {
    hash: Buffer.alloc(32, CONSTANTS.COINBASE_HASH_CHARACTER, 'ascii'),
    outNum: CONSTANTS.COINBASE_INPUT_INDEX,
    // scriptLength: 0x4d, indicates 77 bytes length of height(8bytes) +
    // script(69bytes)
    // height: 0x04FFFF001D010445,
    // script:
    //     '5468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73',
    scriptLength: 69,
    height: 0,
    script:
        'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks',
    sequence: CONSTANTS.COINBASE_INPUT_SEQUENCE
  },
  numOutput: 1,
  outputs: [{
    value: 50,
    // scriptLength: 43,
    // script:
    //     4104678AFDB0FE5548271967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5FAC,
    scriptLength: 23,
    script: 'Not the original script'
  }],
  lockTime: 0x00000000
};

// tslint:disable-next-line:variable-name
export const _genesis: BlockData = {
  version: 1,
  prevHash: Buffer.alloc(32, 0x00),
  // merkleRoot: Buffer.from([
  //   0x3b, 0xa3, 0xed, 0xfd, 0x7a, 0x7b, 0x12, 0xb2, 0x7a, 0xc7, 0x2c,
  //   0x3e, 0x67, 0x76, 0x8f, 0x61, 0x7f, 0xc8, 0x1b, 0xc3, 0x88, 0x8a,
  //   0x51, 0x32, 0x3a, 0x9f, 0xb8, 0xaa, 0x4b, 0x1e, 0x5e, 0x4a
  // ]),
  merkleRoot: hashx2(CoinBase.fromData(_genesis_coinbase).serialize()),
  time: 0x29ab5f49,
  nBits: 0xffff001d,
  nonce: 0x1dac2b7c,
  count: 1,
  coinbase: _genesis_coinbase,
  transactions: []
};

type BlockWithoutFuncs = NonFunctionProperties<Block>;
type BlockDataInterim = {
  [K in keyof BlockWithoutFuncs]: K extends
  'coinbase' ? CoinBaseData : K extends
  'transactions' ? TransactionData[] : BlockWithoutFuncs[K];
};
export type BlockData = Omit<BlockDataInterim, 'id'>;
export type UnminedBlock = Omit<Block, 'nBits'|'nonce'|'id'|'prevHash'|'time'>;
