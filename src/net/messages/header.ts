import crypto from 'crypto';

import config from '../../appconfig';
import {NETWORK} from '../../constants';
import {Logger, tree} from '../../utils/logger';

import {MessageTypes} from './message';

const log = new Logger(`APP_HEADER_${process.pid}`);

export class Header {
  constructor(
      private readonly _cmd: MessageTypes,
      private readonly _bytes: number|null = null,
      private readonly _checksum: Buffer|null = null,
      private readonly _magic: number = NETWORK
          [config.network ?
               config.network.type ? config.network.type : 'Testnet' :
               'Testnet']) {}

  static deserialize(packet: Buffer): Header|null {
    const checksum = this.verifyHeader(packet);
    if (!checksum) {
      log.d('Header checksum failed for packet: ', tree(packet));
      return null;
    }
    return new Header(
        this.deCmd(packet), this.deSize(packet), checksum,
        this.deMagic(packet));
  }

  get cmd(): MessageTypes {
    return this._cmd;
  }

  get magic(): number {
    return this._magic;
  }

  serialize(payload: Buffer): Buffer {
    return Buffer.concat([
      this.seMagic(this.magic), this.seCmd(this.cmd), this.seSize(payload),
      this.seChecksum(payload)
    ]);
  }

  private seMagic(num: number): Buffer {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32LE(num, 0);
    return buf;
  }

  private seCmd(cmd: MessageTypes): Buffer {
    const buf = Buffer.from(cmd, 'ascii');
    if (buf.length < 12) {
      const pad = Buffer.alloc(12 - buf.length, 0x00);
      pad.write('\0', 0, pad.length, 'ascii');
      return Buffer.concat([buf, pad]);
    }
    return buf;
  }

  private seSize(payload: Buffer): Buffer {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32LE(payload.length !== 0 ? payload.length : 0, 0);
    return buf;
  }

  private seChecksum(payload: Buffer): Buffer {
    const hashX2 = crypto.createHash('sha256')
                       .update(crypto.createHash('sha256')
                                   .update(payload.length !== 0 ? payload : '')
                                   .digest())
                       .digest();
    return hashX2.slice(0, 4);
  }

  private static deMagic(packet: Buffer): number {
    return packet.readUInt32LE(0);
  }

  private static deCmd(packet: Buffer): MessageTypes {
    const str = packet.toString('ascii', 4, 16);
    const nul = str.indexOf('\u0000');
    return nul < 0 ? str as MessageTypes : str.slice(0, nul) as MessageTypes;
  }

  private static deSize(packet: Buffer): number {
    return packet.readUInt32LE(16);
  }

  private static deChecksum(packet: Buffer): Buffer|undefined {
    const xhashX2 =
        crypto.createHash('sha256')
            .update(crypto.createHash('sha256')
                        .update(packet.length > 20 ? packet.slice(20) : '')
                        .digest())
            .digest();

    if (xhashX2.slice(0, 4).compare(packet.slice(16, 20)))
      return packet.slice(16, 20);

    log.d('Received checksum did not pass: ', xhashX2, packet.slice(16, 20));
    log.d('Expected: ', xhashX2);
    log.d('Received: ', packet.slice(16, 20));
    return undefined;
  }

  private static verifyHeader(packet: Buffer): Buffer|undefined {
    if (packet.length >= 20) {
      const checksum = this.deChecksum(packet);
      if (!checksum) return undefined;

      return checksum;
    }
    log.d('Received packet of length < 20bytes: ', packet);
    return undefined;
  }
}
