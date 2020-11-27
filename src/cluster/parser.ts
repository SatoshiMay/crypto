import assert from 'assert';

import {Transaction} from '../coins/transaction';

import {MempoolMessage} from './message';

export class Parser {
  constructor() {}

  static txAddMessage(msg: MempoolMessage): Transaction {
    const tx = Transaction.fromJSON(msg.data);
    return tx;
  }

  static txDelMessage(msg: MempoolMessage): Buffer[] {
    const txIds: Buffer[] = JSON.parse(
        msg.data,
        (key, value) =>
            value && value.type === 'Buffer' ? Buffer.from(value.data) : value);
    return txIds;
  }
}
