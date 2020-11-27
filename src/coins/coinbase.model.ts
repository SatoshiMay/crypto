import {ObjectId} from 'mongodb';

import {Database} from '../database/database';
import {Omit} from '../utils/type-mappings';

import {Input, Output} from './coinbase';

export interface InputDocument extends Input {
  _id: ObjectId;
}
// tslint:disable:variable-name
export const InputColl =
    Database.model<InputDocument>('coinbaseinputs').collection;

export interface OutputDocument extends Output {
  _id: ObjectId;
}
export const OutputColl =
    Database.model<OutputDocument>('coinbaseoutputs').collection;

export interface WitnessDocument {
  _id: ObjectId;
}
export const WitnessColl =
    Database.model<WitnessDocument>('coinbasewitnesses').collection;

export interface CoinBaseDocument {
  version: number;
  flag?: number;
  numInput: 1;
  inputRef: ObjectId;
  numOutput: number;
  outputRefs: ObjectId[];
  witnessRefs?: ObjectId[];
  lockTime: number;
  _id: Buffer;
}
export interface CoinBaseDocumentDeRefd extends
    Omit<CoinBaseDocument, 'inputRef'|'outputRefs'|'witnessRefs'> {
  input: InputDocument;
  outputs: OutputDocument[];
  witnesses?: WitnessDocument[];
}
export const CoinBaseColl =
    Database.model<CoinBaseDocument>('coinbases').collection;
