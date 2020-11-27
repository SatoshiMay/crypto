import {BufReader, BufWriter} from '../utils/buf-read-write';
import {hashx2} from '../utils/hashx2';
import {NonFunctionProperties, Omit} from '../utils/type-mappings';

export class BlockHeader {
  version: number;
  prevHash: Buffer;
  merkleRoot: Buffer;
  // time: Date;
  time: number;
  nBits: number;
  nonce: number;

  constructor() {}

  protected static deserialize(reader: BufReader): BlockHeaderData;
  protected static deserialize(buf: Buffer): BlockHeaderData;
  protected static deserialize(x: Buffer|BufReader): BlockHeaderData {
    let br: BufReader;
    if (x instanceof Buffer)
      br = new BufReader(x);
    else
      br = x;

    const version = br.read32UInt();

    const prevHash = br.readBytes(32);

    const merkleRoot = br.readBytes(32);

    // const time = new Date(br.read32UInt() * 1000);
    const time = br.read32UInt();

    const nBits = br.read32UInt();

    const nonce = br.read32UInt();

    return {version, prevHash, merkleRoot, time, nBits, nonce};
  }

  serialize(): Buffer {
    const bw = new BufWriter();

    bw.write32Int(this.version);

    bw.writeBuffer(this.prevHash);

    bw.writeBuffer(this.merkleRoot);

    // bw.write32UInt(Math.round(this.time.getTime() / 1000));
    bw.write32UInt(this.time);

    bw.write32UInt(this.nBits);

    bw.write32UInt(this.nonce);

    return bw.buffer;
  }
}

export type BlockHeaderData = NonFunctionProperties<BlockHeader>;
