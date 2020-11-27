import {ObjectId} from 'mongodb';

import {Input, Output} from '../coins/transaction';
import {Database} from '../database/database';
import {Omit} from '../utils/type-mappings';

export interface InputDocument extends Input {
  _id: ObjectId;
}
// tslint:disable:variable-name
export const InputModel = Database.model<InputDocument>('transactioninputs');
InputModel.addIndex({prevOut: 1}, {unique: true});
export const InputColl = InputModel.collection;

export interface OutputDocument extends Output {
  _id: ObjectId;
}
export const OutputColl =
    Database.model<OutputDocument>('transactionoutputs').collection;

export interface WitnessDocument {
  _id: ObjectId;
}
export const WitnessColl =
    Database.model<WitnessDocument>('transactionwitnesses').collection;

export interface TxDocument {
  version: number;
  flag?: number;
  numInput: number;
  inputRefs: ObjectId[];
  numOutput: number;
  outputRefs: ObjectId[];
  witnessRefs: ObjectId[];
  lockTime: number;
  _id: Buffer;
}
export interface TxDocumentDeRefd extends
    Omit<TxDocument, 'inputRefs'|'outputRefs'|'witnessRefs'> {
  inputs: InputDocument[];
  outputs: OutputDocument[];
  witnesses?: WitnessDocument[];
}
export const TransactionColl =
    Database.model<TxDocument>('transactions').collection;
