import crypto from 'crypto';

import {BlockData} from '../../src/blockchain/block';
import {TransactionData} from '../../src/coins/transaction';
import * as CONSTANTS from '../../src/constants';

import {generateCoinBase} from './coinbase.seed';
import {generateTransaction} from './transaction.seed';

export function generateBlock(prev: Buffer): BlockData {
  const version = 1;
  const prevHash = Buffer.from(prev);  // crypto.randomBytes(32);
  const merkleRoot = crypto.randomBytes(32);
  // const time = new Date(Math.floor(Date.now()/1000)*1000);
  const time = Math.floor(Date.now() / 1000);
  const nBits = Math.floor(Math.random() * (2 ** 32));
  const nonce = Math.floor(Math.random() * (2 ** 32));
  const count = Math.floor(Math.random() * (CONSTANTS.MAX_TX_PER_BLOCK));
  const coinbase = generateCoinBase();
  const transactions: TransactionData[] = [] as TransactionData[];
  for (let i = 0; i < count - 1; i++) transactions.push(generateTransaction());

  return {
    version,
    prevHash,
    merkleRoot,
    time,
    nBits,
    nonce,
    count,
    coinbase,
    transactions
  };
}
