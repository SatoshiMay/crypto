import {readVarInt, varIntLength, writeVarInt} from './varint';

export class BufReader {
  constructor(private _buffer: Buffer) {}

  get buffer(): Buffer {
    return this._buffer;
  }

  read32UInt(): number {
    const val = this._buffer.readUInt32LE(0);
    this._buffer = this._buffer.slice(4);
    return val;
  }

  read32Int(): number {
    const val = this._buffer.readInt32LE(0);
    this._buffer = this._buffer.slice(4);
    return val;
  }

  readVarInt(): number {
    const count = readVarInt(this._buffer);
    this._buffer = this._buffer.slice(varIntLength(count));
    return count;
  }

  readDouble(): number {
    const val = this._buffer.readDoubleLE(0);
    this._buffer = this._buffer.slice(8);
    return val;
  }

  readAscii(length: number): string {
    const val = this._buffer.toString('ascii', 0, length);
    this._buffer = this._buffer.slice(length);
    return val;
  }

  readBytes(num: number): Buffer {
    const buf = Buffer.from(this._buffer.slice(0, num));
    this._buffer = this._buffer.slice(num);
    return buf;
  }
}

export class BufWriter {
  constructor(private _buffer: Buffer = Buffer.alloc(0)) {}

  get buffer(): Buffer {
    return this._buffer;
  }

  write32UInt(num: number): void {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32LE(num, 0);
    this._buffer = Buffer.concat([this._buffer, buf]);
  }

  write32Int(num: number): void {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32LE(num, 0);
    this._buffer = Buffer.concat([this._buffer, buf]);
  }

  writeVarInt(num: number): void {
    const buf = writeVarInt(num);
    this._buffer = Buffer.concat([this._buffer, buf]);
  }

  writeDouble(num: number): void {
    const buf = Buffer.allocUnsafe(8);
    buf.writeDoubleLE(num, 0);
    this._buffer = Buffer.concat([this._buffer, buf]);
  }

  writeAscii(str: string): void {
    const buf = Buffer.from(str, 'ascii');
    this._buffer = Buffer.concat([this._buffer, buf]);
  }

  writeBuffer(buf: Buffer): void {
    this._buffer = Buffer.concat([this._buffer, Buffer.from(buf)]);
  }
}
