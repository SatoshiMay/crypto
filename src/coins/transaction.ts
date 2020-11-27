import * as CONSTANTS from '../constants';
import {BufReader, BufWriter} from '../utils/buf-read-write';
import {hashx2} from '../utils/hashx2';
import {NonFunctionProperties, Omit} from '../utils/type-mappings';

export interface Outpoint {
  hash: Buffer;
  outNum: number;
}

export interface Input {
  prevOut: Outpoint;
  scriptLength: number;
  script: string;
  sequence: number;
}

export interface Output {
  value: number;
  scriptLength: number;
  script: string;
}

export interface Witness {}

export class Transaction implements TransactionData {
  version: number;
  flag?: number;
  numInput: number;
  inputs: Input[];
  numOutput: number;
  outputs: Output[];
  witnesses?: Witness[];
  lockTime: number;
  private _id: Buffer;

  constructor() {}

  static fromData(data: TransactionData): Transaction {
    const tx = new this();
    // tx.version = data.version || options.protocol.version;
    // if (data.flag) tx.flag = data.flag;
    // tx.numInput = data.numInput;
    // tx.inputs = data.inputs as Input[];
    // data.inputs.forEach((input, index) => {
    //   input.sequence ? tx.inputs[index].sequence = input.sequence :
    //                    tx.inputs[index].sequence = TX_INPUT_SEQUENCE;
    // });
    // tx.numOutput = data.numOutput;
    // tx.outputs = data.outputs as Output[];
    // if (data.witnesses) tx.witnesses = data.witnesses;
    // tx.lockTime = data.lockTime;
    Object.assign(tx, data);
    tx._id = hashx2(tx.serialize());

    return tx;
  }

  static fromTransfers(xfer: {
    inputs: Array<{from: string; outpoint: Outpoint}>,
    outputs: Array<{to: string, amount: number}>
  }): Transaction {
    const version = 1;
    const numInput = xfer.inputs.length;
    const inputs: Input[] = [];
    for (const input of xfer.inputs)
      inputs.push({
        prevOut: input.outpoint,
        scriptLength: input.from.length,
        script: input.from,
        sequence: CONSTANTS.TX_INPUT_SEQUENCE
      });
    const numOutput = xfer.outputs.length;
    const outputs: Output[] = [];
    for (const output of xfer.outputs)
      outputs.push({
        value: output.amount,
        scriptLength: output.to.length,
        script: output.to
      });
    const lockTime = Math.floor(Date.now() / 1000);

    const data: TransactionData =
        {version, numInput, inputs, numOutput, outputs, lockTime};

    return this.fromData(data);
  }

  static fromJSON(json: string): Transaction {
    const tx = new this();

    const parsed = JSON.parse(json, (key, value) => {
      return value && value.type === 'Buffer' ? Buffer.from(value.data) : value;
    });
    Object.assign(tx, parsed);

    return tx;
  }

  JSON(): string {
    return JSON.stringify(this);
  }

  get id(): Buffer {
    return this._id;
  }

  static deserialize(reader: BufReader): TransactionData;
  static deserialize(buf: Buffer): TransactionData;
  static deserialize(x: Buffer|BufReader): TransactionData {
    let br: BufReader;
    if (x instanceof Buffer)
      br = new BufReader(x);
    else
      br = x;

    const version = br.read32UInt();
    // const flag = reader.null();

    const numInput = br.readVarInt();

    const inputs: Input[] = [];
    for (let index = 0; index < numInput; index++)
      inputs.push(this.readTxInput(br));

    const numOutput = br.readVarInt();

    const outputs: Output[] = [];
    for (let index = 0; index < numOutput; index++)
      outputs.push(this.readTxOutput(br));

    // const witnesses = this.witnessesFromBr(br);
    const lockTime = br.read32UInt();

    return {version, numInput, inputs, numOutput, outputs, lockTime};
  }

  serialize(): Buffer {
    const bw = new BufWriter();

    bw.write32Int(this.version);
    // if (flag) bw.write16UInt(this.flag);

    bw.writeVarInt(this.numInput);

    for (let index = 0; index < this.numInput; index++)
      this.writeTxInput(bw, this.inputs[index]);

    bw.writeVarInt(this.numOutput);

    for (let index = 0; index < this.numOutput; index++)
      this.writeTxOutput(bw, this.outputs[index]);

    // bw.writeWitnesses(this.witnesses);
    bw.write32UInt(this.lockTime);

    return bw.buffer;
  }

  private static readOutpoint(br: BufReader): Outpoint {
    return {hash: br.readBytes(32), outNum: br.read32Int()};
  }

  private static readTxInput(br: BufReader): Input {
    return (() => {
      const prevOut = this.readOutpoint(br);
      const scriptLength = br.readVarInt();
      const script = br.readAscii(scriptLength);
      const sequence = br.read32UInt();
      return {prevOut, scriptLength, script, sequence};
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

  private writeTxInput(bw: BufWriter, input: Input): void {
    bw.writeBuffer(input.prevOut.hash);
    bw.write32Int(input.prevOut.outNum);
    bw.writeVarInt(input.scriptLength);
    bw.writeAscii(input.script);
    bw.write32UInt(input.sequence);
  }

  private writeTxOutput(bw: BufWriter, output: Output): void {
    bw.writeDouble(output.value);
    bw.writeVarInt(output.scriptLength);
    bw.writeAscii(output.script);
  }

  static getOutputSum(txs: Transaction[]): number;
  static getOutputSum(tx: Transaction): number;
  static getOutputSum(x: Transaction|Transaction[]): number {
    if (x instanceof Array) {
      const total = x.map(tx => this.getOutputSum(tx));
      return total.reduce((acc, val) => acc + val, 0);
    }
    return x.getOutputSum();
  }

  getOutputSum(): number {
    return this.outputs.reduce((acc, output) => acc + output.value, 0);
  }
}

export type TransactionData = Omit<NonFunctionProperties<Transaction>, 'id'>;
