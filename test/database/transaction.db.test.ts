import crypto from 'crypto';
import {ObjectId} from 'mongodb';
import {URL} from 'url';
import uuid from 'uuid/v4';

import {Transaction} from '../../src/coins/transaction';
import {TransactionDB} from '../../src/coins/transaction.db';
import {InputColl, OutputColl, TransactionColl} from '../../src/coins/transaction.model';
import {Database} from '../../src/database/database';
import {generateTransaction} from '../seed/transaction.seed';

const mongoUrl = new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid());
const mongoOpts = {
  useNewUrlParser: true,
  promoteBuffers: true
};

describe('Transaction Database', () => {
  beforeAll(() => Database.connect(mongoUrl, mongoOpts));

  beforeEach(() => Database.drop());

  afterAll(() => Database.drop().then(() => Database.disconnect()));

  describe('save() method', () => {
    test('create() with one randomly generated transaction ', async () => {
      const data = generateTransaction();

      const result = await TransactionDB.save(Transaction.fromData(data));
      const transaction =
          await TransactionColl().findOne({_id: result.insertedId});
      expect(transaction).toBeTruthy();
      expect(await InputColl().countDocuments({})).toEqual(1);
      expect(await OutputColl().countDocuments({})).toEqual(1);
      expect(await TransactionColl().countDocuments({})).toEqual(1);
      const [inputDoc, outputDoc] = await Promise.all(
          [InputColl().findOne({}), OutputColl().findOne({})]);
      expect((transaction!._id)
                 .equals(
                     crypto.createHash('sha256')
                         .update(
                             crypto.createHash('sha256')
                                 .update(Transaction.fromData(data).serialize())
                                 .digest())
                         .digest()))
          .toEqual(true);
      expect(inputDoc!._id.toHexString())
          .toEqual((transaction!.inputRefs[0]).toHexString());
      expect(outputDoc!._id.toHexString())
          .toEqual((transaction!.outputRefs[0]).toString());
      expect(transaction!.witnessRefs).toBeUndefined();
    });
  });

  describe('saveWithTpc() method', () => {
    test('create() with one randomly generated transaction ', async () => {
      const data = generateTransaction();

      const transaction = Transaction.fromData(data);
      await TransactionDB.saveWithTpc(transaction);
      const saved = await TransactionColl().findOne({_id: transaction.id});
      expect(saved).toBeTruthy();
      expect(await InputColl().countDocuments({})).toEqual(1);
      expect(await OutputColl().countDocuments({})).toEqual(1);
      expect(await TransactionColl().countDocuments({})).toEqual(1);
      const [inputDoc, outputDoc] = await Promise.all(
          [InputColl().findOne({}), OutputColl().findOne({})]);
      expect((saved!._id)
                 .equals(
                     crypto.createHash('sha256')
                         .update(
                             crypto.createHash('sha256')
                                 .update(Transaction.fromData(data).serialize())
                                 .digest())
                         .digest()))
          .toEqual(true);
      expect(inputDoc!._id.toHexString())
          .toEqual((saved!.inputRefs[0]).toHexString());
      expect(outputDoc!._id.toHexString())
          .toEqual((saved!.outputRefs[0]).toString());
      expect(saved!.witnessRefs).toBeUndefined();
    });
  });

  describe('Get transaction input sum', () => {
    test('Returns input sum of zero', async () => {
      const data1 = generateTransaction();
      const tx1 = Transaction.fromData(data1);
      await TransactionDB.save(tx1);

      const data2 = generateTransaction();
      const tx2 = Transaction.fromData(data2);
      const totalInput = await TransactionDB.getInputSum(tx2);
      expect(totalInput).toEqual(0);
    });

    test('Tx with one input', async () => {
      const data1 = generateTransaction(2, 10);
      const tx1 = Transaction.fromData(data1);
      await TransactionDB.save(tx1);

      const data2 = generateTransaction();
      data2.inputs[0].prevOut.hash = tx1.id;
      const index1 = Math.floor(Math.random() * tx1.numOutput);
      data2.inputs[0].prevOut.outNum = index1;
      const tx2 = Transaction.fromData(data2);
      await TransactionDB.save(tx2);
      const totalInput = await TransactionDB.getInputSum(tx2);
      expect(totalInput).toEqual(tx1.outputs[index1].value);
    });

    test('Tx with two inputs', async () => {
      const data1 = generateTransaction(3, 10);
      const tx1 = Transaction.fromData(data1);
      await TransactionDB.save(tx1);

      const data2 = generateTransaction(4, 5);
      const tx2 = Transaction.fromData(data2);
      await TransactionDB.save(tx2);

      const data3 = generateTransaction();
      data3.numInput = 2;
      data3.inputs[0].prevOut.hash = tx1.id;
      const index1 = Math.floor(Math.random() * tx1.numOutput);
      data3.inputs[0].prevOut.outNum = index1;
      const index2 = Math.floor(Math.random() * tx2.numOutput);
      data3.inputs[1] = {
        script: data3.inputs[0].script,
        scriptLength: data3.inputs[0].scriptLength,
        sequence: data3.inputs[0].sequence,
        prevOut: {hash: tx2.id, outNum: index2}
      };
      const tx3 = Transaction.fromData(data3);
      await TransactionDB.save(tx3);
      const totalInput = await TransactionDB.getInputSum(tx3);
      expect(totalInput)
          .toEqual(tx1.outputs[index1].value + tx2.outputs[index2].value);
    });
  });
});
