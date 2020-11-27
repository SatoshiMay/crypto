import {EventEmitter} from 'events';

import {Block} from '../blockchain/block';
import {Transaction} from '../coins/transaction';
import {assertNever} from '../utils/error';
import {Logger, tree} from '../utils/logger';

import {BlockMessage} from './messages/block-message';
import {Message, MessageTypes} from './messages/message';
import {TxMessage} from './messages/tx-message';
import {VerMessage} from './messages/ver-message';

const log = new Logger(`APP_AP_CTRL_${process.pid}`);

export class Controller extends EventEmitter {
  constructor() {
    super();
    this.init();
  }

  private init(): void {
    this.addListeners();
  }

  private createMessage(cmd: MessageTypes, data: any): Message {
    let message: Message;
    switch (cmd) {
      case 'version':
        message = new VerMessage();
        log.d('Controller created version message');
        return message;
      case 'tx':
        message = TxMessage.fromTx(data);
        log.d('Controller created tx message');
        return message;
      case 'block':
        message = BlockMessage.fromBlock(data);
        log.d('Controller created block message');
        return message;
      default:
        return assertNever(
            cmd, `Controller receieved unknown create command: '${cmd}'`);
    }
  }

  private handleParser(message: Message): void {
    switch (message.type) {
      case 'version':
        log.d('Controller received version message');
        break;
      case 'tx':
        log.d('Controller received tx message');
        this.emit('foreignTx', message.payload);
        break;
      case 'block':
        log.d('Controller received block message');
        this.emit('foreignBlock', message.payload);
        break;
      default:
        return assertNever(
            message, `Controller received unknown message: '${tree(message)}'`);
    }
  }

  private addListeners(): void {
    this.on('selfOrRelayBlock', (block: Block) => {
      log.d('Controller received block from ApEntity');
      const message = this.createMessage('block', block);
      if (message) this.emit('selfOrRelayMessage', message);
    });

    this.on('selfTx', (tx: Transaction) => {
      log.d('Controller received transaction from ApEntity');
      const message = this.createMessage('tx', tx);
      if (message) this.emit('selfOrRelayMessage', message);
    });

    this.on('foreignMessage', (message: Message) => {
      log.d('Controller received message from ApEntity');
      this.handleParser(message);
    });
  }
}
