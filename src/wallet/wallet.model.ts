import {ObjectId} from 'mongodb';
import {Database} from '../database/database';

export interface AccountDocument {
  _id: ObjectId;
  username: string;
  pubKey: string;
}
// tslint:disable:variable-name
const AccountModel = Database.model<AccountDocument>('accounts');
AccountModel.addIndex({username: 1}, {unique: true});
export const AccountColl = AccountModel.collection;

export interface DepositDocument {
  _id: ObjectId;
  value: number;
  accountRef: ObjectId;
  reference: {hash: Buffer; outNum: number;};
  state: 'unspent'|'pending'|'spent';
}
export const DepositColl =
    Database.model<DepositDocument>('deposits').collection;
