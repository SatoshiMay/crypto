import * as CONSTANTS from '../constants';
import {BufReader, BufWriter} from '../utils/buf-read-write';
import {hashx2} from '../utils/hashx2';
import {randomString} from '../utils/random-string';
import {NonFunctionProperties, Omit} from '../utils/type-mappings';

export interface Input {
  hash: Buffer;
  outNum: number;
  scriptLength: number;
  height: number;
  script: string;
  sequence: number;
}

export interface Output {
  value: number;
  scriptLength: number;
  script: string;
}

interface Witness {}

export class CoinBase implements CoinBaseData {
  version: number;
  flag?: number;
  numInput: 1;
  input: Input;
  numOutput: number;
  outputs: Output[];
  witnesses?: Witness[];
  lockTime: number;
  private _id: Buffer;

  constructor() {}

  static fromData(data: CoinBaseData): CoinBase {
    const coinbase = new this();
    Object.assign(coinbase, data);
    coinbase._id = hashx2(coinbase.serialize());

    return coinbase;
  }

  static fromOutput(output: Output): CoinBase {
    const version = 1;
    const numInput = 1;
    const input: Input = (() => {
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
    const outputs = [output];
    const lockTime = Math.floor(Date.now() / 1000);
    const data:
        CoinBaseData = {version, numInput, input, numOutput, outputs, lockTime};

    return this.fromData(data);
  }

  get id(): Buffer {
    return this._id;
  }

  static deserialize(reader: BufReader): CoinBaseData;
  static deserialize(buf: Buffer): CoinBaseData;
  static deserialize(x: Buffer|BufReader): CoinBaseData {
    let br;
    if (x instanceof Buffer)
      br = new BufReader(x);
    else
      br = x;

    const version = br.read32UInt();
    // const flag = reader.null();

    const numInput = br.readVarInt() as 1;

    const input = this.readTxInput(br);

    const numOutput = br.readVarInt();

    const outputs: Output[] = [];
    for (let index = 0; index < numOutput; index++)
      outputs.push(this.readTxOutput(br));

    // const witnesses = this.witnessesFromBr(br);
    const lockTime = br.read32UInt();

    return {version, numInput, input, numOutput, outputs, lockTime};
  }

  serialize(): Buffer {
    const bw = new BufWriter();

    bw.write32Int(this.version);
    // if (flag) bw.write16UInt(this.flag);
    bw.writeVarInt(this.numInput);

    this.writeTxInput(bw);

    bw.writeVarInt(this.numOutput);

    for (let index = 0; index < this.numOutput; index++)
      this.writeTxOutput(bw, this.outputs[index]);

    // bw.writeWitnesses(this.witnesses);
    bw.write32UInt(this.lockTime);

    return bw.buffer;
  }

  private static readHeight(br: BufReader): number {
    return 0;
  }

  private static readTxInput(br: BufReader): Input {
    return (() => {
      const hash = br.readBytes(32);
      const outNum = br.read32UInt();
      const scriptLength = br.readVarInt();
      const height = this.readHeight(br);
      const script = br.readAscii(scriptLength);
      const sequence = br.read32UInt();
      return {hash, outNum, scriptLength, height, script, sequence};
    })();
  }

  private static readTxOutput(br: BufReader): Output {
    return (() => {
      const value = br.readDouble();
      const scriptLength = br.readVarInt();
      const script = br.readAscii(scriptLength);
      return {value, scriptLength, script};
    })();
  }

  private writeHeight(bw: BufWriter): void {
    bw.writeBuffer(Buffer.alloc(0));
  }

  private writeTxInput(bw: BufWriter): void {
    bw.writeBuffer(this.input.hash);
    bw.write32UInt(this.input.outNum);
    bw.writeVarInt(this.input.scriptLength);
    this.writeHeight(bw);
    bw.writeAscii(this.input.script);
    bw.write32UInt(this.input.sequence);
  }

  private writeTxOutput(bw: BufWriter, output: Output): void {
    bw.writeDouble(output.value);
    bw.writeVarInt(output.scriptLength);
    bw.writeAscii(output.script);
  }
}

export type CoinBaseData = Omit<NonFunctionProperties<CoinBase>, 'id'>;
