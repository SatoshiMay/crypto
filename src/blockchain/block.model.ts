import {CoinBaseDocument} from '../coins/coinbase.model';
import {TxDocument} from '../coins/transaction.model';
import {Database} from '../database/database';
import {Omit} from '../utils/type-mappings';

export interface BlockDocument {
  version: number;
  prevHash: Buffer;
  merkleRoot: Buffer;
  time: number;
  nBits: number;
  nonce: number;
  count: number;  // including coinbase
  coinbaseRef: Buffer;
  transactionRefs: Buffer[];
  _id: Buffer;
  height: number;
}

export interface BlockDocumentDeRefd extends
    Omit<BlockDocument, 'coinbaseRef'|'transactionRefs'> {
  coinbase: CoinBaseDocument;
  transactions: TxDocument;
}

// tslint:disable:variable-name
export const BlockColl = Database.model<BlockDocument>('blocks').collection;
