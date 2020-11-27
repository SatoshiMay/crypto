import {assertNever} from './error';

export function writeVarInt(num: number): Buffer {
  let buf: Buffer;
  switch (true) {
    case num < 0xfd:
      buf = Buffer.allocUnsafe(1);
      buf.writeUInt8(num, 0);
      return buf;
    case num <= 0xffff:
      buf = Buffer.allocUnsafe(3);
      buf.writeUInt8(0xfd, 0);
      buf.writeUInt16LE(num, 1);
      return buf;
    case num <= 0xffffffff:
      buf = Buffer.allocUnsafe(5);
      buf.writeUInt8(0xfe, 0);
      buf.writeUInt32LE(num, 1);
      return buf;
    default:
      return assertNever(
          num as never, `writeVarInt received out of range num: '${num}'`);
  }
}

export function readVarInt(buf: Buffer): number {
  const first = buf.readUInt8(0);
  switch (true) {
    case first < 0xfd:
      return first;
    case first === 0xfd:
      return buf.readUInt16LE(1);
    case first === 0xfe:
      return buf.readUInt32LE(1);
    default:
      return assertNever(
          buf as never, `readVarInt received out of range buffer: '${buf}'`);
  }
}

export function varIntLength(num: number): number {
  switch (true) {
    case num < 0xfd:
      return 1;
    case num <= 0xffff:
      return 3;
    case num <= 0xffffffff:
      return 5;
    default:
      return assertNever(
          num as never, `varIntLength received out of range num: '${num}'`);
  }
}
