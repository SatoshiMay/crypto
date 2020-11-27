import crypto from 'crypto';

import {Input, Output, TransactionData} from '../../src/coins/transaction';
import * as CONSTANTS from '../../src/constants';
import {randomString} from '../../src/utils/random-string';

export function generateTransaction(numIns = 1, numOuts = 1): TransactionData {
  const version = 1;
  const numInput = numIns;
  const inputs: Input[] = [];
  for (let i = 0; i < numInput; i++) {
    const prevOut = {
      hash: crypto.randomBytes(32),
      outNum: Math.floor(Math.random() * 1000)
    };
    const scriptLength =
        Math.floor(Math.random() * CONSTANTS.MAX_SIG_SCRYPT_BYTES);
    const script = randomString(scriptLength);
    const sequence = CONSTANTS.TX_INPUT_SEQUENCE;
    inputs.push({prevOut, scriptLength, script, sequence});
  }
  const numOutput = numOuts;
  const outputs: Output[] = [];
  for (let i = 0; i < numOutput; i++) {
    const value = Math.floor(
        Math.random() * CONSTANTS.BLOCK_SUBSIDY * CONSTANTS.SATOSHI_IN_BTC);
    const scriptLength =
        Math.floor(Math.random() * CONSTANTS.MAX_PK_SCRIPT_BYTES);
    const script = randomString(scriptLength);
    outputs.push({value, scriptLength, script});
  }
  const lockTime = Math.floor(Date.now() / 1000);
  return {version, numInput, inputs, numOutput, outputs, lockTime};
}
