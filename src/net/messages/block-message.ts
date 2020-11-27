import {Block, BlockData} from '../../blockchain/block';

export class BlockMessage {
  private _payload: Block;

  constructor(private readonly _type: 'block' = 'block') {}

  get type(): 'block' {
    return this._type;
  }

  get payload(): Block {
    return this._payload;
  }

  static fromData(data: BlockData): BlockMessage {
    const msg = new this();
    // msg.payload = options;
    // for (const key in payload)
    //   if (payload.hasOwnProperty(key))
    //     msg.payload[key as keyof Transaction] =
    //         payload[key as keyof Transaction];
    // Object.assign(msg.payload, payload);
    msg._payload = Block.fromData(data);

    return msg;
  }

  static fromBlock(block: Block): BlockMessage {
    const msg = new this();
    msg._payload = block;

    return msg;
  }

  static deserialize(buf: Buffer): BlockMessage {
    const data = Block.deserialize(buf);
    return this.fromData(data);
  }

  serialize(): Buffer {
    return this._payload.serialize();
  }
}
