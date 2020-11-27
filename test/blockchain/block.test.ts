import {_genesis, Block} from '../../src/blockchain/block';
import {CoinBase} from '../../src/coins/coinbase';
import {hashx2} from '../../src/utils/hashx2';
import {generateBlock} from '../seed/block.seed';

describe('Block', () => {
  describe('With random data', () => {
    const data = generateBlock(Buffer.alloc(32, 0));
    const block = Block.fromData(data);

    test('Serialize and Deserialize', () => {
      expect.assertions(1);
      const serialized = block.serialize();
      const received = Block.deserialize(serialized);
      expect(received).toEqual(data);
    });
  });
});

describe('Genesis', () => {
  const data = _genesis;
  const genesis = Block.fromData(data);

  test('Merkleroot', () => {
    expect.assertions(1);
    const received = genesis.coinbase.id;
    // const expected = _genesis.merkleRoot;
    const expected = hashx2(CoinBase.fromData(_genesis.coinbase).serialize());
    expect(received.equals(expected)).toEqual(true);
  });

  test('Serialize and Deserialize', () => {
    expect.assertions(1);
    const serialized = genesis.serialize();
    const received = Block.deserialize(serialized);
    expect(received).toEqual(data);
  });
});
