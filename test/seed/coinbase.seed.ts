import {CoinBaseData} from '../../src/coins/coinbase';
import * as CONSTANTS from '../../src/constants';
import {randomString} from '../../src/utils/random-string';

export function generateCoinBase(): CoinBaseData {
  const version = 1;
  const numInput = 1;
  const input = (() => {
    const hash = Buffer.alloc(32, CONSTANTS.COINBASE_HASH_CHARACTER, 'ascii');
    const outNum = CONSTANTS.COINBASE_INPUT_INDEX;
    const height = 0;
    const scriptLength =
        Math.floor(Math.random() * CONSTANTS.MAX_SIG_SCRYPT_BYTES);
    const script = randomString(scriptLength);
    const sequence = CONSTANTS.COINBASE_INPUT_SEQUENCE;
    return {hash, outNum, scriptLength, height, script, sequence};
  })();
  const numOutput = 1;
  const outputs = (() => {
    const value = CONSTANTS.BLOCK_SUBSIDY * CONSTANTS.SATOSHI_IN_BTC;
    const scriptLength =
        Math.floor(Math.random() * CONSTANTS.MAX_PK_SCRIPT_BYTES);
    const script = randomString(scriptLength);
    return [{value, scriptLength, script}];
  })();
  const lockTime = Math.floor(Date.now() / 1000);
  return {version, numInput, input, numOutput, outputs, lockTime};
}
