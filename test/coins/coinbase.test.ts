import {CoinBase} from '../../src/coins/coinbase';
import {generateCoinBase} from '../seed/coinbase.seed';

describe('CoinBase', () => {
  describe('Data with one input and one output', () => {
    const data = generateCoinBase();
    const coinbase = CoinBase.fromData(data);

    test(
        'Serialize',
        () => {
            // const bv = Buffer.from([0x02, 0x00, 0x00, 0x00]);
            // const bni = Buffer.from([0x01]);
            // const bi = Buffer.concat([
            //   Buffer.from(payload.inputs[0].prevOut.hash),
            //   Buffer.from([payload.inputs[0].prevOut.index, 0x00, 0x00,
            //   0x00]),
            //   Buffer.from([0xff, 0xff, 0xff, 0xff])
            // ]);
            // const bno = Buffer.from([0x01]);
            // const bOv = Buffer.alloc(8);
            // bOv.writeDoubleLE(payload.outputs[0].value, 0);
            // const bo = Buffer.concat([bOv]);
            // const bl = Buffer.from([0x78, 0x56, 0x34, 0x12]);
            // const expected = Buffer.concat([bv, bni, bi, bno, bo, bl]);
            // const received = msg.serialize();
            // expect(received.equals(expected)).toEqual(true);
        });

    test('Deserialize', () => {
      expect.assertions(1);
      const serialized = coinbase.serialize();
      const received = CoinBase.deserialize(serialized);
      expect(received).toEqual(data);
    });
  });
});
