export const COINBASE_INPUT_SEQUENCE = 0x00000000;
export const COINBASE_HASH_CHARACTER = '\0';
export const COINBASE_INPUT_INDEX = 0xffffffff;
export const TX_INPUT_SEQUENCE = 0xffffffff;
export const MAX_SIG_SCRYPT_BYTES = 100;
export const MAX_PK_SCRIPT_BYTES = 100;  // 10000
export const MAX_TX_PER_BLOCK = 10;
export const AP_HEADER_SIZE = 24;

export const SATOSHI_IN_BTC = 10 ** 8;
export const BLOCK_SUBSIDY = 12.5;
export const BLOCK_VERSION = 1.0;

export const NETWORK: {[network: string]: number} = {
  'Main': 0xd9b4bef9,
  'Testnet': 0xdab5bffa,
  'Testnet3': 0x0709110b,
  'Namecoin': 0xfeb4bef9
};
