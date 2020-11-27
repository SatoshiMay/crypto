import {Transaction, TransactionData} from '../../coins/transaction';

export class TxMessage {
  private _payload: Transaction;

  constructor(private readonly _type: 'tx' = 'tx') {}

  get type(): 'tx' {
    return this._type;
  }

  get payload(): Transaction {
    return this._payload;
  }

  static fromData(data: TransactionData): TxMessage {
    const msg = new this();
    // msg.payload = options;
    // for (const key in payload)
    //   if (payload.hasOwnProperty(key))
    //     msg.payload[key as keyof Transaction] =
    //         payload[key as keyof Transaction];
    // Object.assign(msg.payload, payload);
    msg._payload = Transaction.fromData(data);

    return msg;
  }

  static fromTx(tx: Transaction): TxMessage {
    const msg = new this();
    msg._payload = tx;

    return msg;
  }

  static deserialize(buf: Buffer): TxMessage {
    const data = Transaction.deserialize(buf);
    return this.fromData(data);
  }

  serialize(): Buffer {
    return this.payload.serialize();
  }
}
