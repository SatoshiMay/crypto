import supertest, {SuperTest, Test} from 'supertest';
import {URL} from 'url';
import uuid from 'uuid/v4';

import {Block} from '../../../src/blockchain/block';
import * as CONSTANTS from '../../../src/constants';
import {Database} from '../../../src/database/database';
import {FullNode} from '../../../src/fullnode';

const fullnode = new FullNode();
const params = {
  // mongoUrl: new URL('mongodb://localhost:27017/test_trinity'),
  mongoUrl: new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid()),
  mongoOpts: {useNewUrlParser: true, promoteBuffers: true},
  p2pPort: 0,
  peerUrls: [],
  httpPort: 0
};

let request: SuperTest<Test>;
let minerBalance = 0;
const username = 'dummyUser';
let dummyBalance = 0;

describe('Http Server', () => {
  beforeAll(() => fullnode.start(params).then(params => {
    request = supertest(`http://localhost:${params.httpPort}`);
  }));

  // Make sure to not drop Database initialized by fullnode.start
  // beforeEach(() => db.dropDatabase());

  afterAll(
      () =>
          Database.drop()
              .then(() => fullnode.stop())
              .catch((err: any) => console.log('Error closing down: %O', err)));

  describe('startup tests', () => {
    test('Get wallet accounts on startup', async () => {
      await request
          .get('/wallet/accounts')

          .expect(200)
          .then(res => res.body)
          .then(body => {
            expect(body.length).toEqual(1);
            expect(body[0].username).toEqual('miner');
          });
    });

    test('Get miner\'s account on startup', async () => {
      await request
          .get('/wallet/accounts/miner')

          .expect(200)
          .then(res => res.body)
          .then(body => {
            expect(body.username).toEqual('miner');
            expect(body.pubKey).toBeTruthy();
          });
    });

    test('Get miner\'s account balance on startup', async () => {
      await request
          .get('/wallet/accounts/miner/balance')

          .expect(200)
          .then(res => res.body)
          .then(body => {
            expect(body).toEqual(minerBalance);
          });
    });

    test('Get genesis block on startup', async () => {
      await request
          .get('/chain')

          .expect(200)
          .then(res => res.body)
          .then(body => {
            expect(body.length).toEqual(1);
            const prevHash = Buffer.from(body[0].prevHash);
            expect(prevHash.equals(Buffer.alloc(32, 0))).toBe(true);
            const selfHash = Buffer.from(body[0]._id.data);
            expect(selfHash.equals(Block.genesis.id)).toBe(true);
          });
    });

    describe('Test scenarios after startup', () => {
      describe('Mine a block with no transactions', () => {
        test('Mine a block', (done) => {
          request
              .get('/mine')

              .expect(200)
              .expect('Hello from Miner')
              .then(_ => {
                setTimeout(() => {
                  minerBalance +=
                      CONSTANTS.BLOCK_SUBSIDY * CONSTANTS.SATOSHI_IN_BTC;
                  done();
                }, 100);  // wait 100ms for dust to settle
              });
        });

        test(
            'Get miner\'s account balance after mining one block with no tx',
            async () => {
              await request
                  .get('/wallet/accounts/miner/balance')

                  .expect(200)
                  .then(res => res.body)
                  .then(body => {
                    expect(body).toEqual(minerBalance);
                  });
            });
      });

      describe('Create account in addition to miners account', () => {
        test('Create account', async () => {
          await request.post('/wallet/accounts')
              .send({username})
              .expect(200)
              .then(res => res.body)
              .then(body => {
                expect(body.username).toEqual(username);
                expect(body.pubKey).toBeTruthy();
              });
        });

        test('Get two accounts', async () => {
          await request.get('/wallet/accounts')
              .expect(200)
              .then(res => res.body)
              .then(body => {
                expect(body.length).toEqual(2);
                expect(body[0].username).toEqual('miner');
                expect(body[0].pubKey).toBeTruthy();
                expect(body[1].username).toEqual(username);
                expect(body[1].pubKey).toBeTruthy();
              });
        });

        describe('Create tx from miner to another a/c in same wallet', () => {
          test('Create single tx', (done) => {
            const value = 900000000;
            request.post('/wallet/accounts/transaction')
                .send({'from': 'miner', 'to': username, value})
                .expect(200)
                .then(_ => {
                  setTimeout(done, 100);  // wait 100ms for dust to settle
                });
          });

          test('Mine the transactions at source node', (done) => {
            request
                .get('/mine')

                .expect(200)
                .expect('Hello from Miner')
                .then(_ => {
                  setTimeout(() => {
                    minerBalance -= 900000000;
                    minerBalance +=
                        CONSTANTS.BLOCK_SUBSIDY * CONSTANTS.SATOSHI_IN_BTC;
                    dummyBalance += 900000000;
                    done();
                  }, 100);  // wait 100ms for dust to settle
                });
          });

          test('Get account balances after mining', async () => {
            await request
                .get('/wallet/accounts/miner/balance')

                .expect(200)
                .then(res => res.body)
                .then(body => {
                  expect(body).toEqual(minerBalance);
                });

            await request
                .get('/wallet/accounts/dummyUser/balance')

                .expect(200)
                .then(res => res.body)
                .then(body => {
                  expect(body).toEqual(dummyBalance);
                });
          });
        });

        describe('Create tx from other a/c in same wallet to miner', () => {
          test('Create single tx', (done) => {
            const value = 600000000;
            request.post('/wallet/accounts/transaction')
                .send({'from': 'dummyUser', 'to': 'miner', value})
                .expect(200)
                .then(_ => {
                  setTimeout(done, 100);  // wait 100ms for dust to settle
                });
          });

          test('Mine the transactions at source node', (done) => {
            request
                .get('/mine')

                .expect(200)
                .expect('Hello from Miner')
                .then(_ => {
                  setTimeout(() => {
                    dummyBalance -= 600000000;
                    minerBalance += 600000000;
                    minerBalance +=
                        CONSTANTS.BLOCK_SUBSIDY * CONSTANTS.SATOSHI_IN_BTC;
                    done();
                  }, 100);  // wait 100ms for dust to settle
                });
          });

          test('Get account balances after mining', async () => {
            await request
                .get('/wallet/accounts/miner/balance')

                .expect(200)
                .then(res => res.body)
                .then(body => {
                  expect(body).toEqual(minerBalance);
                });

            await request
                .get('/wallet/accounts/dummyUser/balance')

                .expect(200)
                .then(res => res.body)
                .then(body => {
                  expect(body).toEqual(dummyBalance);
                });
          });
        });
      });
    });
  });
});
