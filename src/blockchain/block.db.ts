import assert from 'assert';
import {InsertOneWriteOpResult} from 'mongodb';

import {CoinBaseDB} from '../coins/coinbase.db';
import {TransactionDB} from '../coins/transaction.db';
import {Tpc} from '../database/tpc';
import {tree} from '../utils/logger';

import {Block} from './block';
import {BlockColl, BlockDocument, BlockDocumentDeRefd} from './block.model';

export class BlockDb {
  constructor() {}

  static async save(block: Block): Promise<InsertOneWriteOpResult> {
    const prevHeight = await this.findPrevHeight(block);
    assert(
        prevHeight !== null,
        `While saving block, could not find prev Block ${tree(block)}`);

    const coinbase$ = CoinBaseDB.save(block.coinbase);
    const transactions$ = block.transactions.map(tx => TransactionDB.save(tx));

    const [coinbase] = await Promise.all([coinbase$]);
    const transactions = await Promise.all(transactions$);

    const doc: BlockDocument = {
      version: block.version,
      prevHash: block.prevHash,
      merkleRoot: block.merkleRoot,
      time: block.time,
      nBits: block.nBits,
      nonce: block.nonce,
      count: block.count,
      coinbaseRef: coinbase.insertedId as any as
          Buffer,  // TODO check for better way
      transactionRefs:
          transactions.map(result => result.insertedId as any as Buffer),
      _id: block.id,
      height: prevHeight! + 1
    };
    // BlockModel.create(doc);
    return BlockColl().insertOne(doc);
  }

  static async saveWithTpc(block: Block): Promise<void>;
  static async saveWithTpc(block: Block, tpc: Tpc): Promise<Tpc>;
  static async saveWithTpc(block: Block, tpc?: Tpc): Promise<void|Tpc> {
    let t: Tpc;
    if (tpc)
      t = tpc;
    else
      t = new Tpc();

    const prevHeight = await this.findPrevHeight(block);
    assert(
        prevHeight !== null,
        `While saving block, could not find prev Block ${tree(block)}`);

    CoinBaseDB.saveWithTpc(block.coinbase, t);
    block.transactions.map(tx => TransactionDB.saveWithTpc(tx, t));

    const doc: BlockDocument = {
      version: block.version,
      prevHash: block.prevHash,
      merkleRoot: block.merkleRoot,
      time: block.time,
      nBits: block.nBits,
      nonce: block.nonce,
      count: block.count,
      coinbaseRef: block.coinbase.id,
      transactionRefs: block.transactions.map(tx => tx.id),
      _id: block.id,
      height: prevHeight! + 1
    };
    t.insert(BlockColl(), doc);

    if (tpc)
      return t;
    else
      return t.run();
  }

  static async findPrevHeight(block: Block): Promise<number|null> {
    if (block.id.equals(Block.genesis.id)) return -1;

    const prevBlock = await BlockColl().findOne({_id: block.prevHash});
    if (!prevBlock)
      return null;
    else
      return prevBlock.height;
  }

  private static async findChainHeight(): Promise<number|null> {
    return this.findHead().then(doc => doc ? doc.height : null);
  }

  static async findHead(): Promise<BlockDocument|null> {
    return BlockColl()
        .find({})
        .sort({height: -1})
        .limit(1)
        .toArray()
        .then(docs => docs.length ? docs[0] : null);
  }

  static async findGenesis(): Promise<BlockDocument|null> {
    const genesisDoc = await BlockColl().findOne({_id: Block.genesis.id});
    if (!genesisDoc) return null;

    return genesisDoc;
  }

  static async getBlocks(): Promise<BlockDocumentDeRefd[]> {
    return BlockColl().aggregate<BlockDocumentDeRefd>([
      {$match: {}},
      {$lookup: {
        from: 'coinbases',
        localField: 'coinbaseRef',
        foreignField: '_id',
        as: 'coinbase'
      }},
      {$unwind: '$coinbase'},
      {$lookup: {
          from: 'transactions',
          localField: 'transactionRefs',
          foreignField: '_id',
          as: 'transactions'
      }}
    ])
    .toArray();
  }

  static async exists(block: Block): Promise<boolean> {
    return await BlockColl().findOne({_id: block.id}) !== null;
  }
}
