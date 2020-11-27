import {EventEmitter} from 'events';

import {AP_HEADER_SIZE} from '../constants';
import {assertNever} from '../utils/error';
import {Logger, tree} from '../utils/logger';

import {BlockMessage} from './messages/block-message';
import {Header} from './messages/header';
import {Message, MessageTypes} from './messages/message';
import {TxMessage} from './messages/tx-message';
import {VerMessage} from './messages/ver-message';

const log = new Logger(`APP_AP_PARSER_${process.pid}`);

export class Parser extends EventEmitter {
  constructor() {
    super();
    this.init();
  }

  private init(): void {
    this.addListeners();
  }

  private serializePayload(msg: Message): Buffer {
    return msg.serialize();
  }

  private serializeHeader(cmd: MessageTypes, payload: Buffer): Buffer {
    const header = new Header(cmd);
    return header.serialize(payload);
  }

  private parsePayload(buf: Buffer, header: Header): Message {
    switch (header.cmd) {
      case 'tx':
        return TxMessage.deserialize(buf);
      case 'version':
        return new VerMessage();
      case 'block':
        return BlockMessage.deserialize(buf);
      default:
        return assertNever(
            header.cmd,
            `Parse unable to parse packet,  header: '${header}', buf: '${
                buf}'`);
    }
  }

  private parseHeader(buf: Buffer): Header|null {
    return Header.deserialize(buf);
  }

  private fromAp2Socket(msg: Message): Buffer {
    const payload = this.serializePayload(msg);
    const header = this.serializeHeader(msg.type, payload);
    return Buffer.concat([header, payload]);
  }

  private fromSocket2Ap(packet: Buffer): Message|null {
    const header = this.parseHeader(packet.slice(0, AP_HEADER_SIZE));
    if (header) return this.parsePayload(packet.slice(AP_HEADER_SIZE), header);

    return null;
  }

  private addListeners(): void {
    this.on('foreignPacket', (packet: Buffer) => {
      log.d('Parser received packet from ApEntity');
      const deserialized = this.fromSocket2Ap(packet);
      if (deserialized) this.emit('foreignMessage', deserialized);
    });

    this.on('selfOrRelayMessage', (message: Message) => {
      log.d('Parser received message from ApEntity');
      const packet = this.fromAp2Socket(message);
      this.emit('selfOrRelayPacket', packet);
    });
  }
}
