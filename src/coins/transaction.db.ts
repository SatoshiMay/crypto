import assert from 'assert';
import {InsertOneWriteOpResult, ObjectId} from 'mongodb';

import {Tpc} from '../database/tpc';

import {CoinBaseDB} from './coinbase.db';
import {Transaction} from './transaction';
import {InputColl, InputDocument, OutputColl, OutputDocument, TransactionColl, TxDocument, TxDocumentDeRefd, WitnessColl, WitnessDocument} from './transaction.model';

export class TransactionDB {
  constructor() {}

  static async save(tx: Transaction): Promise<InsertOneWriteOpResult> {
    const inputs$ = InputColl().insertMany(tx.inputs);

    const outputs$ = OutputColl().insertMany(tx.outputs);
    const witnesses$ =

        tx.witnesses ? WitnessColl().insertMany(tx.witnesses) :
                       Promise.resolve(undefined);

    const [inputDocs, outputDocs, witnessDocs] =
        await Promise.all([inputs$, outputs$, witnesses$]);

    const doc: TxDocument = {} as TxDocument;
    doc.version = tx.version;
    doc.flag = tx.flag;
    doc.numInput = tx.numInput;
    doc.inputRefs = Object.keys(inputDocs.insertedIds)
                        .map(key => inputDocs.insertedIds[+key]);
    doc.numOutput = tx.numOutput;
    doc.outputRefs = Object.keys(outputDocs.insertedIds)
                         .map(key => outputDocs.insertedIds[+key]);
    if (witnessDocs)
      doc.witnessRefs = Object.keys(witnessDocs.insertedIds)
                            .map(key => witnessDocs.insertedIds[+key]);

    doc.lockTime = tx.lockTime;
    doc._id = tx.id;

    return TransactionColl().insertOne(doc);
  }

  static saveWithTpc(tx: Transaction): Promise<void>;
  static saveWithTpc(tx: Transaction, tpc: Tpc): Tpc;
  static saveWithTpc(tx: Transaction, tpc?: Tpc): Promise<void>|Tpc {
    let t: Tpc;
    if (tpc)
      t = tpc;
    else
      t = new Tpc();

    const inputDocs: InputDocument[] =
        tx.inputs.map(i => ({...i, _id: new ObjectId()}));
    t.insert(InputColl(), inputDocs);

    const outputDocs: OutputDocument[] =
        tx.outputs.map(o => ({...o, _id: new ObjectId()}));
    t.insert(OutputColl(), outputDocs);

    let witnessDocs: WitnessDocument[] = [];
    if (tx.witnesses) {
      witnessDocs = tx.witnesses.map(w => ({...w, _id: new ObjectId()}));
      t.insert(WitnessColl(), witnessDocs);
    }

    const txDoc: TxDocument = {} as TxDocument;
    txDoc.version = tx.version;
    txDoc.flag = tx.flag;
    txDoc.numInput = tx.numInput;
    txDoc.inputRefs = inputDocs.map(i => i._id);
    txDoc.numOutput = tx.numOutput;
    txDoc.outputRefs = outputDocs.map(o => o._id);
    if (tx.witnesses) txDoc.witnessRefs = witnessDocs.map(w => w._id);
    txDoc.lockTime = tx.lockTime;
    txDoc._id = tx.id;
    t.insert(TransactionColl(), txDoc);

    if (tpc)
      return t;
    else
      return t.run();
  }

  static async verify(tx: Transaction): Promise<boolean> {
    const unSpent$ = this.isUnspent(tx);
    const outLessThanIn$ = this.isOutLessThanIn(tx);

    const [unspent, outLessThanIn] =
        await Promise.all([unSpent$, outLessThanIn$]);

    if (unspent && outLessThanIn) return true;

    return false;
  }

  private static async isUnspent(tx: Transaction): Promise<boolean> {
    const outpoints = tx.inputs.map(input => input.prevOut);
    const result = await InputColl().findOne({prevOut: {$in: outpoints}});
    if (result !== null) return false;
    return true;
  }

  static async getInputSum(txs: Transaction[]): Promise<number>;
  static async getInputSum(tx: Transaction): Promise<number>;
  static async getInputSum(x: Transaction|Transaction[]): Promise<number> {
    if (x instanceof Array) {
      const total$ = x.map(tx => this.getInputSum(tx));
      const total = await Promise.all(total$);
      return total.reduce((acc, val) => acc + val, 0);
    }

    const hashes = x.inputs.map(input => input.prevOut.hash);
    const prevTxDocs = await TransactionColl().aggregate
                                <Pick<TxDocumentDeRefd, '_id'|'outputs'>>([
                                  {$match: {_id: {$in: hashes}}},
                                  {$limit: hashes.length},
                                  {$lookup: {
                                    from: 'transactionoutputs',
                                    localField: 'outputRefs',
                                    foreignField: '_id',
                                    as: 'outputs'
                                  }},
                                  {$project: {outputs: 1}}
                                ])
                                .toArray();

    const totalIn = prevTxDocs.reduce((acc, doc) => {
      const inputIndex =
          x.inputs.findIndex(i => i.prevOut.hash.equals(doc._id));

      assert(
          inputIndex > -1,
          `Transaction does not point to found prevDoc,\nx: ${x},\ndoc: ${
              doc}`);

      const outIndex = x.inputs[inputIndex].prevOut.outNum;
      const value = (doc.outputs as OutputDocument[])[outIndex].value;
      return value + acc;
    }, 0);

    return totalIn;
  }

  private static async isOutLessThanIn(tx: Transaction): Promise<boolean> {
    const [sumFromTxs, sumFromCBs] =
        await Promise.all([this.getInputSum(tx), CoinBaseDB.getInputSum(tx)]);
    const totalIn = sumFromTxs + sumFromCBs;
    const totalOut = tx.getOutputSum();

    return totalIn >= totalOut;
  }
}
