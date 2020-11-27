import {TxMessage} from './tx-message';
import {VerMessage} from './ver-message';
import { BlockMessage } from './block-message';

export type Message = TxMessage|VerMessage|BlockMessage;
export type MessageTypes = Message['type'];
