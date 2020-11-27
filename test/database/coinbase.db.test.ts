import crypto from 'crypto';
import {URL} from 'url';
import uuid from 'uuid/v4';

import {CoinBase, CoinBaseData} from '../../src/coins/coinbase';
import {CoinBaseDB} from '../../src/coins/coinbase.db';
import {CoinBaseColl, InputColl, OutputColl} from '../../src/coins/coinbase.model';
import {Database} from '../../src/database/database';

const mongoUrl = new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid());
const mongoOpts = {
  useNewUrlParser: true,
  promoteBuffers: true
};

describe('CoinBase', () => {
  beforeAll(() => Database.connect(mongoUrl, mongoOpts));

  beforeEach(() => Database.drop());

  afterAll(() => Database.drop().then(() => Database.disconnect()));

  describe('save() method', () => {
    test(
        'create() a deterministic transaction with one input and one output',
        async () => {
          const data: CoinBaseData = {
            version: 1,
            numInput: 1,
            input: {
              hash: Buffer.alloc(32, '\0', 'ascii'),
              outNum: 0xffffffff,
              scriptLength: 2,
              height: 1,
              script: 'saveCoinBase test input script',
              sequence: 0x00000000
            },
            numOutput: 1,
            outputs: [{
              value: 101,
              scriptLength: 2,
              script: 'saveCOinBase test output script'
            }],
            lockTime: 0x123456
          };

          const result = await CoinBaseDB.save(CoinBase.fromData(data));
          const coinbase =
              await CoinBaseColl().findOne({_id: result.insertedId});
          expect(coinbase).toBeTruthy();
          expect(await InputColl().countDocuments({})).toEqual(1);
          expect(await OutputColl().countDocuments({})).toEqual(1);
          expect(await CoinBaseColl().countDocuments({})).toEqual(1);
          const [inputDoc, outputDoc] = await Promise.all(
              [InputColl().findOne({}), OutputColl().findOne({})]);
          expect(
              coinbase!._id.equals(
                  crypto.createHash('sha256')
                      .update(crypto.createHash('sha256')
                                  .update(CoinBase.fromData(data).serialize())
                                  .digest())
                      .digest()))
              .toEqual(true);
          expect(inputDoc!._id.toHexString())
              .toEqual(coinbase!.inputRef.toHexString());
          expect(outputDoc!._id.toHexString())
              .toEqual(coinbase!.outputRefs[0].toHexString());
          expect(coinbase!.witnessRefs).toBeUndefined();
        });
  });

  describe('saveWithTpc() method', () => {
    test(
        'create() a deterministic transaction with one input and one output',
        async () => {
          const data: CoinBaseData = {
            version: 1,
            numInput: 1,
            input: {
              hash: Buffer.alloc(32, '\0', 'ascii'),
              outNum: 0xffffffff,
              scriptLength: 2,
              height: 1,
              script: 'saveCoinBase test input script',
              sequence: 0x00000000
            },
            numOutput: 1,
            outputs: [{
              value: 101,
              scriptLength: 2,
              script: 'saveCOinBase test output script'
            }],
            lockTime: 0x123456
          };

          const coinbase = CoinBase.fromData(data);
          await CoinBaseDB.saveWithTpc(coinbase);
          const saved = await CoinBaseColl().findOne({_id: coinbase.id});
          expect(saved).toBeTruthy();
          expect(await InputColl().countDocuments({})).toEqual(1);
          expect(await OutputColl().countDocuments({})).toEqual(1);
          expect(await CoinBaseColl().countDocuments({})).toEqual(1);
          const [inputDoc, outputDoc] = await Promise.all(
              [InputColl().findOne({}), OutputColl().findOne({})]);
          expect(
              saved!._id.equals(
                  crypto.createHash('sha256')
                      .update(crypto.createHash('sha256')
                                  .update(CoinBase.fromData(data).serialize())
                                  .digest())
                      .digest()))
              .toEqual(true);
          expect(inputDoc!._id.toHexString())
              .toEqual(saved!.inputRef.toHexString());
          expect(outputDoc!._id.toHexString())
              .toEqual(saved!.outputRefs[0].toHexString());
          expect(saved!.witnessRefs).toBeUndefined();
        });
  });
});
