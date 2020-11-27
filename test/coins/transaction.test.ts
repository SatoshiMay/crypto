import crypto from 'crypto';

import {Transaction, TransactionData} from '../../src/coins/transaction';
import {TX_INPUT_SEQUENCE} from '../../src/constants';
import {hashx2} from '../../src/utils/hashx2';
import {generateTransaction} from '../seed/transaction.seed';

describe('Transaction', () => {
  describe('Predetermined data with one input and one output', () => {
    const data: TransactionData = {
      version: 2,
      numInput: 1,
      inputs: [{
        prevOut: {
          hash: crypto.createHash('sha256')
                    .update(crypto.randomBytes(10))
                    .digest(),
          outNum: Math.floor(Math.random() * 10)
        },
        scriptLength: 1,
        script: '\0',
        sequence: TX_INPUT_SEQUENCE
      }],
      numOutput: 1,
      outputs: [
        {value: Math.floor(Math.random() * 10), scriptLength: 1, script: '\0'}
      ],
      lockTime: 0x12345678
    };
    const transaction = Transaction.fromData(data);

    test('Serialize', () => {
      expect.assertions(1);
      const bv = Buffer.from([0x02, 0x00, 0x00, 0x00]);
      const bni = Buffer.from([0x01]);
      const bi = Buffer.concat([
        Buffer.from(data.inputs[0].prevOut.hash),
        Buffer.from([data.inputs[0].prevOut.outNum, 0x00, 0x00, 0x00]),
        Buffer.from([0x01]), Buffer.from('\0', 'ascii'),
        Buffer.from([0xff, 0xff, 0xff, 0xff])
      ]);
      const bno = Buffer.from([0x01]);
      const bOv = Buffer.alloc(8);
      bOv.writeDoubleLE(data.outputs[0].value, 0);
      const bo =
          Buffer.concat([bOv, Buffer.from([0x01]), Buffer.from('\0', 'ascii')]);
      const bl = Buffer.from([0x78, 0x56, 0x34, 0x12]);
      const expected = Buffer.concat([bv, bni, bi, bno, bo, bl]);
      const received = transaction.serialize();
      expect(received.equals(expected)).toEqual(true);
    });

    test('Deserialize', () => {
      expect.assertions(2);
      const serialized = transaction.serialize();
      const received = Transaction.deserialize(serialized);

      expect(received).toEqual(data);
      expect({...received, _id: hashx2(serialized)}).toEqual(transaction);
    });
  });

  describe('Data with one input and one output', () => {
    const data = generateTransaction();
    const transaction = Transaction.fromData(data);

    test('Deserialize', () => {
      expect.assertions(2);
      const serialized = transaction.serialize();
      const received = Transaction.deserialize(serialized);
      expect(received).toEqual(data);
      expect({...received, _id: hashx2(serialized)}).toEqual(transaction);
    });
  });
});
