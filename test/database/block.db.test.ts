import {URL} from 'url';
import uuid from 'uuid/v4';

import {Block} from '../../src/blockchain/block';
import {BlockDb} from '../../src/blockchain/block.db';
import {BlockColl} from '../../src/blockchain/block.model';
import {CoinBaseColl} from '../../src/coins/coinbase.model';
import {TransactionColl} from '../../src/coins/transaction.model';
import {Database} from '../../src/database/database';
import {hashx2} from '../../src/utils/hashx2';
import {generateBlock} from '../seed/block.seed';

const mongoUrl = new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid());
const mongoOpts = {
  useNewUrlParser: true,
  promoteBuffers: true
};

describe('Block Database', () => {
  beforeAll(() => Database.connect(mongoUrl, mongoOpts));

  beforeEach(() => Database.drop());

  afterAll(() => Database.drop().then(() => Database.disconnect()));

  test('save() genesis block', async () => {
    expect(await BlockDb.findGenesis()).toBeNull();
    const genesis = Block.genesis;
    const result = await BlockDb.save(genesis);
    expect(result.result.ok).toEqual(1);
    const count = await BlockColl().countDocuments({});
    expect(count).toEqual(1);
    const found = await BlockColl().findOne({});
    expect(found).toBeTruthy();
    expect(found!.height).toEqual(0);
    // expect(JSON.parse(JSON.stringify(saved)))
    //     .toEqual(JSON.parse(JSON.stringify(found)));
    expect(genesis.id.equals(found!._id)).toEqual(true);

    expect(await BlockDb.findGenesis()).toBeTruthy();
  });

  test('save() genesis and block pointing to genesis', async () => {
    const genesis = Block.genesis;
    await BlockDb.save(genesis);

    const data = generateBlock(genesis.id);
    const result = await BlockDb.save(Block.fromData(data));
    const saved = await BlockColl().findOne({_id: Block.fromData(data).id});
    expect(await CoinBaseColl().countDocuments({})).toEqual(2);
    expect(await TransactionColl().countDocuments({}))
        .toEqual(data.transactions.length);
    expect(await BlockColl().countDocuments({})).toEqual(2);
    expect(result.result.ok).toEqual(1);
    expect(saved!.prevHash.equals(genesis.id)).toBe(true);
    expect(saved!._id.equals(hashx2(Block.fromData(data).serializeHeader())))
        .toEqual(true);

    const coinbaseDoc = await CoinBaseColl().findOne({_id: saved!.coinbaseRef});
    expect(coinbaseDoc!._id.toString()).toEqual(saved!.coinbaseRef.toString());

    const transactionDocs = await TransactionColl().find({}).toArray();
    transactionDocs.forEach(txDoc => {
      expect(saved!.transactionRefs.map(tx => tx.toString())
                 .indexOf(txDoc._id.toString()))
          .toBeGreaterThan(-1);
    });
  });

  test('save multiple blocks', async () => {
    expect.assertions(12);
    expect(await BlockDb.findHead()).toBeNull();

    const genesis = Block.genesis;
    const result0 = await BlockDb.save(genesis);
    const saved0 = await BlockColl().findOne({_id: result0.insertedId});
    const head0 = await BlockDb.findHead();
    const data1 = generateBlock(genesis.id);
    const block1 = Block.fromData(data1);
    const result1 = await BlockDb.save(block1);
    const saved1 = await BlockColl().findOne({_id: result1.insertedId});
    const head1 = await BlockDb.findHead();
    const data2 = generateBlock(block1.id);
    const block2 = Block.fromData(data2);
    const result2 = await BlockDb.save(block2);
    const saved2 = await BlockColl().findOne({_id: result2.insertedId});
    const head2 = await BlockDb.findHead();
    const data3 = generateBlock(block2.id);
    const block3 = Block.fromData(data3);
    const result3 = await BlockDb.save(block3);
    const saved3 = await BlockColl().findOne({_id: result3.insertedId});
    const head3 = await BlockDb.findHead();

    expect(head0!._id.equals(saved0!._id)).toEqual(true);
    expect(head1!._id.equals(saved1!._id)).toEqual(true);
    expect(head2!._id.equals(saved2!._id)).toEqual(true);
    expect(head3!._id.equals(saved3!._id)).toEqual(true);
    expect(saved1!.height).toEqual(1);
    expect(saved2!.height).toEqual(2);
    expect(saved3!.height).toEqual(3);
    expect(saved1!.prevHash.equals(head0!._id)).toEqual(true);
    expect(saved2!.prevHash.equals(head1!._id)).toEqual(true);
    expect(saved3!.prevHash.equals(head2!._id)).toEqual(true);
    expect(await BlockDb.findGenesis()).toBeTruthy();
  });

  test('saveWithTpc() genesis block', async () => {
    expect(await BlockDb.findGenesis()).toBeNull();
    const genesis = Block.genesis;
    await BlockDb.saveWithTpc(genesis);
    const count = await BlockColl().countDocuments({});
    expect(count).toEqual(1);
    const found = await BlockColl().findOne({});
    expect(found).toBeTruthy();
    expect(found!.height).toEqual(0);
    // expect(JSON.parse(JSON.stringify(saved)))
    //     .toEqual(JSON.parse(JSON.stringify(found)));
    expect(genesis.id.equals(found!._id)).toEqual(true);

    expect(await BlockDb.findGenesis()).toBeTruthy();
  });

  test('saveWithTpc() genesis and block pointing to genesis', async () => {
    const genesis = Block.genesis;
    await BlockDb.saveWithTpc(genesis);

    const data = generateBlock(genesis.id);
    const block = Block.fromData(data);
    await BlockDb.saveWithTpc(block);
    const saved = await BlockColl().findOne({_id: block.id});
    expect(await CoinBaseColl().countDocuments({})).toEqual(2);
    expect(await TransactionColl().countDocuments({}))
        .toEqual(data.transactions.length);
    expect(await BlockColl().countDocuments({})).toEqual(2);
    expect(saved!.prevHash.equals(genesis.id)).toBe(true);
    expect(saved!._id.equals(hashx2(Block.fromData(data).serializeHeader())))
        .toEqual(true);

    const coinbaseDoc = await CoinBaseColl().findOne({_id: saved!.coinbaseRef});
    expect(coinbaseDoc!._id.toString()).toEqual(saved!.coinbaseRef.toString());

    const transactionDocs = await TransactionColl().find({}).toArray();
    transactionDocs.forEach(txDoc => {
      expect(saved!.transactionRefs.map(tx => tx.toString())
                 .indexOf(txDoc._id.toString()))
          .toBeGreaterThan(-1);
    });
  });

  test('saveWithTpc multiple blocks', async () => {
    expect.assertions(12);
    expect(await BlockDb.findHead()).toBeNull();

    const genesis = Block.genesis;
    await BlockDb.saveWithTpc(genesis);
    const saved0 = await BlockColl().findOne({_id: genesis.id});
    const head0 = await BlockDb.findHead();
    const data1 = generateBlock(genesis.id);
    const block1 = Block.fromData(data1);
    await BlockDb.saveWithTpc(block1);
    const saved1 = await BlockColl().findOne({_id: block1.id});
    const head1 = await BlockDb.findHead();
    const data2 = generateBlock(block1.id);
    const block2 = Block.fromData(data2);
    await BlockDb.saveWithTpc(block2);
    const saved2 = await BlockColl().findOne({_id: block2.id});
    const head2 = await BlockDb.findHead();
    const data3 = generateBlock(block2.id);
    const block3 = Block.fromData(data3);
    await BlockDb.saveWithTpc(block3);
    const saved3 = await BlockColl().findOne({_id: block3.id});
    const head3 = await BlockDb.findHead();

    expect(head0!._id.equals(saved0!._id)).toEqual(true);
    expect(head1!._id.equals(saved1!._id)).toEqual(true);
    expect(head2!._id.equals(saved2!._id)).toEqual(true);
    expect(head3!._id.equals(saved3!._id)).toEqual(true);
    expect(saved1!.height).toEqual(1);
    expect(saved2!.height).toEqual(2);
    expect(saved3!.height).toEqual(3);
    expect(saved1!.prevHash.equals(head0!._id)).toEqual(true);
    expect(saved2!.prevHash.equals(head1!._id)).toEqual(true);
    expect(saved3!.prevHash.equals(head2!._id)).toEqual(true);
    expect(await BlockDb.findGenesis()).toBeTruthy();
  });
});
