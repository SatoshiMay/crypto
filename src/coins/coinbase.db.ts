import assert from 'assert';
import {InsertOneWriteOpResult, ObjectId} from 'mongodb';

import {CoinBase} from '../coins/coinbase';
import {Transaction} from '../coins/transaction';
import {InsertCommit} from '../database/commit';
import {Tpc} from '../database/tpc';

import {CoinBaseColl, CoinBaseDocument, CoinBaseDocumentDeRefd, InputColl, InputDocument, OutputColl, OutputDocument, WitnessColl, WitnessDocument} from './coinbase.model';

export class CoinBaseDB {
  constructor() {}

  static async save(coinbase: CoinBase): Promise<InsertOneWriteOpResult> {
    const input$ = InputColl().insertOne(coinbase.input);
    const outputs$ = OutputColl().insertMany(coinbase.outputs);
    const witnesses$ =

        coinbase.witnesses ? WitnessColl().insertMany(coinbase.witnesses) :
                             Promise.resolve(undefined);

    const [input, outputs, witnesses] =
        await Promise.all([input$, outputs$, witnesses$]);


    const doc: CoinBaseDocument = {} as CoinBaseDocument;
    doc.version = coinbase.version;
    doc.flag = coinbase.flag;
    doc.numInput = 1;
    doc.inputRef = input.insertedId;
    doc.numOutput = coinbase.numOutput;
    doc.outputRefs =
        Object.keys(outputs.insertedIds).map(key => outputs.insertedIds[+key]);
    if (witnesses)
      doc.witnessRefs = Object.keys(witnesses.insertedIds)
                            .map(key => witnesses.insertedIds[+key]);
    doc.lockTime = coinbase.lockTime;
    doc._id = coinbase.id;

    return CoinBaseColl().insertOne(doc);
  }

  static saveWithTpc(coinbase: CoinBase): Promise<void>;
  static saveWithTpc(coinbase: CoinBase, tpc: Tpc): Tpc;
  static saveWithTpc(coinbase: CoinBase, tpc?: Tpc): Promise<void>|Tpc {
    let t: Tpc;
    if (tpc)
      t = tpc;
    else
      t = new Tpc();

    const inputDoc: InputDocument = {...coinbase.input, _id: new ObjectId()};
    t.insert(InputColl(), inputDoc);

    const outputDocs: OutputDocument[] =
        coinbase.outputs.map(o => ({...o, _id: new ObjectId()}));
    t.insert(OutputColl(), outputDocs);

    let witnessDocs: WitnessDocument[] = [];
    if (coinbase.witnesses) {
      witnessDocs = coinbase.witnesses.map(w => ({...w, _id: new ObjectId()}));
      t.insert(WitnessColl(), witnessDocs);
    }

    const cbDoc: CoinBaseDocument = {} as CoinBaseDocument;
    cbDoc.version = coinbase.version;
    cbDoc.flag = coinbase.flag;
    cbDoc.numInput = 1;
    cbDoc.inputRef = inputDoc._id;
    cbDoc.numOutput = coinbase.numOutput;
    cbDoc.outputRefs = outputDocs.map(o => o._id);
    if (coinbase.witnesses) cbDoc.witnessRefs = witnessDocs.map(w => w._id);
    cbDoc.lockTime = coinbase.lockTime;
    cbDoc._id = coinbase.id;
    t.insert(CoinBaseColl(), cbDoc);

    if (tpc)
      return t;
    else
      return t.run();
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
    const prevCBDocs = await CoinBaseColl().aggregate
                              <Pick<CoinBaseDocumentDeRefd, '_id' | 'outputs'>>([
                                {$match: {_id: {$in : hashes}}},
                                {$limit: hashes.length},
                                {$lookup: {
                                  from: 'coinbaseoutputs',
                                  localField: 'outputRefs',
                                  foreignField: '_id',
                                  as: 'outputs'
                                }},
                                {$project: {outputs: 1}}
                              ])
                              .toArray();

    const totalIn = prevCBDocs.reduce((acc, doc) => {
      const inputIndex =
          x.inputs.findIndex(i => i.prevOut.hash.equals(doc._id));

      assert(
          inputIndex > -1,
          `Transaction does not point to found prevDoc,\nx: ${x},\ndoc: ${
              doc}`);

      const outIndex = x.inputs[inputIndex].prevOut.outNum;
      const value = doc.outputs[outIndex].value;
      return value + acc;
    }, 0);

    return totalIn;
  }

  static async verify(cb: CoinBase): Promise<boolean> {
    return true;
  }
}
