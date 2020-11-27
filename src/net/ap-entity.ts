import {EventEmitter} from 'events';

import {Block} from '../blockchain/block';
import {Transaction} from '../coins/transaction';
import {Logger} from '../utils/logger';

import {Controller} from './ap-controller';
import {Parser} from './ap-parser';
import {Message} from './messages/message';

const log = new Logger(`APP_AP_ENTITY_${process.pid}`);

export class ApEntity extends EventEmitter {
  private readonly parser: Parser;
  private readonly controller: Controller;

  constructor() {
    super();

    this.parser = new Parser();
    this.controller = new Controller();
    this.init();
  }

  private init(): void {
    this.registerListeners();
  }

  private registerListeners(): void {
    this.on('selfOrRelayBlock', (block: Block) => {
      log.d('ApEntity received block from Peer');
      this.controller.emit('selfOrRelayBlock', block);
    });

    this.on('selfTx', (tx: Transaction) => {
      log.d('ApEntity received transaction from Peer');
      this.controller.emit('selfTx', tx);
    });

    this.on('foreignPacket', (packet: Buffer) => {
      log.d('ApEntity received packet from Peer');
      this.parser.emit('foreignPacket', packet);
    });

    this.parser.on('foreignMessage', (message: Message) => {
      log.d('ApEntity received message from Parser');
      this.controller.emit('foreignMessage', message);
    });

    this.controller.on('selfOrRelayMessage', (message: Message) => {
      log.d('ApEntity received message from Controller');
      this.parser.emit('selfOrRelayMessage', message);
    });

    this.parser.on('selfOrRelayPacket', (packet: Buffer) => {
      log.d('ApEntity received packet from Parser');
      this.emit('selfOrRelayPacket', packet);
    });

    this.controller.on('foreignBlock', (block: Block) => {
      log.d('ApEntity received block from Controller');
      this.emit('foreignBlock', block);
    });

    this.controller.on('foreignTx', (tx: Transaction) => {
      log.d('ApEntity received transaction from Controller');
      this.emit('foreignTx', tx);
    });
  }
}
