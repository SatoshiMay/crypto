import assert from 'assert';
import supertest, {SuperTest, Test} from 'supertest';
import {URL} from 'url';
import uuid from 'uuid/v4';

import {CoinBaseColl} from '../../src/coins/coinbase.model';
import {Mempool} from '../../src/coins/mempool';
import {Transaction} from '../../src/coins/transaction';
import {Database} from '../../src/database/database';
import {FullNode} from '../../src/fullnode';
import {generateTransaction} from '../seed/transaction.seed';

const fullnode = new FullNode();
const {mempool} = fullnode;

const params = {
  // mongoUrl: new URL('mongodb://localhost:27017/test_trinity'),
  mongoUrl: new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid()),
  mongoOpts: {useNewUrlParser: true, promoteBuffers: true},
  p2pPort: 0,
  peerUrls: [],
  httpPort: 0
};

let req: SuperTest<Test>;
const username = 'dummyUser';

describe('Mempool', () => {
  beforeAll(
      (done) => fullnode.start(params)
                    .then(params => {
                      req = supertest(`http://localhost:${params.httpPort}`);
                    })
                    .then(() => req.get('/mine').then(_ => {}))
                    .then(
                        () => req.post('/wallet/accounts')
                                  .send({username})
                                  .then(_ => {}))
                    .catch(err => {
                      console.log('Error starting fullnode: %O', err);
                      throw err;
                    })
                    .then(() => setTimeout(() => done(), 100)));

  beforeEach(() => {
    Mempool.pending.clear();
  });

  afterAll(
      () =>
          Database.drop()
              .then(() => fullnode.stop())
              .catch((err: any) => console.log('Error closing down: %O', err)));

  test('Reject random incoming tx', (done) => {
    expect.assertions(1);
    const data = generateTransaction(1, 2);
    const transaction = Transaction.fromData(data);

    mempool.emit('foreignTx', transaction);
    setTimeout(() => {
      expect(Mempool.pending.size).toEqual(0);
      done();
    }, 1000);
  });

  test(
      'Reject incoming tx with incorrect outpoint and output more than input',
      async () => {
        expect.assertions(1);

        const data = generateTransaction(1, 2);
        data.inputs[0].prevOut.hash = Buffer.allocUnsafe(32);
        data.inputs[0].prevOut.outNum = 0;
        data.outputs[0].value = 800000000;
        data.outputs[1].value = 450000000;
        const transaction = Transaction.fromData(data);

        mempool.emit('foreignTx', transaction);
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            expect(Mempool.pending.size).toEqual(0);
            resolve();
          }, 100);
        });
      });

  test(
      'Reject incoming tx with correct outpoint but output more than input',
      async () => {
        expect.assertions(1);
        const cbDoc =
            await CoinBaseColl().find({lockTime: {$ne: 0x00000000}}).toArray();
        assert(cbDoc.length === 1);

        const data = generateTransaction(1, 2);
        data.inputs[0].prevOut.hash = cbDoc[0]._id;
        data.inputs[0].prevOut.outNum = 0;
        data.outputs[0].value = 800000000;
        data.outputs[1].value = 450000001;
        const transaction = Transaction.fromData(data);

        mempool.emit('foreignTx', transaction);
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            expect(Mempool.pending.size).toEqual(0);
            resolve();
          }, 100);
        });
      });

  test('Accept incoming tx with invalid outpoint but zero output', async () => {
    expect.assertions(1);

    const data = generateTransaction(1, 2);
    data.inputs[0].prevOut.hash = Buffer.allocUnsafe(32);
    data.inputs[0].prevOut.outNum = 0;
    data.outputs[0].value = 0;
    data.outputs[1].value = 0;
    const transaction = Transaction.fromData(data);

    mempool.emit('foreignTx', transaction);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        expect(Mempool.pending.size).toEqual(1);
        resolve();
      }, 100);
    });
  });

  test('Accept valid incoming tx', async () => {
    expect.assertions(1);
    const cbDoc =
        await CoinBaseColl().find({lockTime: {$ne: 0x00000000}}).toArray();
    assert(cbDoc.length === 1);

    const data = generateTransaction(1, 2);
    data.inputs[0].prevOut.hash = cbDoc[0]._id;
    data.inputs[0].prevOut.outNum = 0;
    data.outputs[0].value = 800000000;
    data.outputs[1].value = 450000000;
    const transaction = Transaction.fromData(data);

    mempool.emit('foreignTx', transaction);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        expect(Mempool.pending.size).toEqual(1);
        resolve();
      }, 100);
    });
  });

  test('Reject a self double spend attempt', async () => {
    expect.assertions(1);
    const cbDoc =
        await CoinBaseColl().find({lockTime: {$ne: 0x00000000}}).toArray();
    assert(cbDoc.length === 1);

    const data = generateTransaction(2, 2);
    data.inputs[0].prevOut.hash = Buffer.from(cbDoc[0]._id);
    data.inputs[0].prevOut.outNum = 0;
    data.inputs[1].prevOut.hash = Buffer.from(cbDoc[0]._id);
    data.inputs[1].prevOut.outNum = 0;
    data.outputs[0].value = 800000000;
    data.outputs[1].value = 450000000;
    const selfDoubleTx = Transaction.fromData(data);

    mempool.emit('foreignTx', selfDoubleTx);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        expect(Mempool.pending.size).toEqual(0);
        resolve();
      }, 100);
    });
  });

  test('Accept one tx and reject a double spend attempt', async () => {
    expect.assertions(1);
    const cbDoc =
        await CoinBaseColl().find({lockTime: {$ne: 0x00000000}}).toArray();
    assert(cbDoc.length === 1);

    const data = generateTransaction(1, 2);
    data.inputs[0].prevOut.hash = Buffer.from(cbDoc[0]._id);
    data.inputs[0].prevOut.outNum = 0;
    data.outputs[0].value = 800000000;
    data.outputs[1].value = 450000000;
    const validTx = Transaction.fromData(data);

    const data2 = generateTransaction(1, 2);
    data2.inputs[0].prevOut.hash = Buffer.from(cbDoc[0]._id);
    data2.inputs[0].prevOut.outNum = 0;
    data2.outputs[0].value = 800000000;
    data2.outputs[1].value = 450000000;
    const doubleSpendTx = Transaction.fromData(data2);

    mempool.emit('foreignTx', validTx);
    mempool.emit('foreignTx', doubleSpendTx);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        expect(Mempool.pending.size).toEqual(1);
        resolve();
      }, 100);
    });
  });
});
