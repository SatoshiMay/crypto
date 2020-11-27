import {EventEmitter} from 'events';
import {IncomingMessage} from 'http';
import WebSocket, {OPEN} from 'ws';

import {Block} from '../blockchain/block';
import {Transaction} from '../coins/transaction';
import {Logger} from '../utils/logger';

import {ApEntity} from './ap-entity';

interface PeerConstructor {
  new(): Peer;
  // fromRemoteAddr(remoteAdd: string): Peer;
  // fromInbound(socket: WebSocket, remoteAdd: string): Peer;
}

const log = new Logger(`APP_PEER_${process.pid}`);

export class Peer extends EventEmitter {
  private socket: WebSocket;
  private remoteAddr: {ip: string|undefined, port: number|undefined};
  private remoteUrl: string;

  readonly apEntity: ApEntity;

  constructor() {
    super();
    this.apEntity = new ApEntity();
  }

  get readyState(this: Peer): number {
    return this.socket.readyState;
  }

  static fromRemoteUrl(this: PeerConstructor, remoteUrl: string): Peer {
    const peer = new this();
    peer.remoteUrl = remoteUrl;
    peer.socket = new WebSocket(remoteUrl);
    peer.registerEvents();
    return peer;
  }

  static fromInbound(
      this: PeerConstructor, socket: WebSocket, req: IncomingMessage): Peer {
    const peer = new this();
    peer.remoteAddr = {
      ip: req.connection.remoteAddress,
      port: req.connection.remotePort
    };
    peer.socket = socket;
    peer.registerEvents();
    return peer;
  }

  close(): void {
    this.socket.close();
  }

  private registerEvents(this: Peer): void {
    this.registerSockEvents();
    this.registerApEvents();
    this.registerPoolEvents();
  }

  private registerSockEvents(this: Peer): void {
    this.socket.on('error', (error) => {
      log.e('Socket error:\n%O', error);
      this.emit('error', error);
    });

    this.socket.on('open', () => {
      log.a('Socket opened to: ', this.remoteUrl);
      this.emit('open');
    });

    this.socket.on('close', () => {
      log.a('Socket closed to/from: ', this.remoteUrl || this.remoteAddr);
      this.emit('close');
    });

    this.socket.on('message', (packet: Buffer) => {
      log.d('Peer received packet from: ', this.remoteUrl || this.remoteAddr);
      this.apEntity.emit('foreignPacket', packet);
    });
  }

  private registerApEvents(this: Peer): void {
    this.apEntity.on('selfOrRelayPacket', (packet: Buffer) => {
      log.d('Peer received packet from ApEntity and sending out to Socket');
      this.socket.send(packet);
    });

    this.apEntity.on('foreignBlock', (block: Block) => {
      log.d('Peer received block from ApEntity');
      this.emit('foreignBlock', block);
    });

    this.apEntity.on('foreignTx', (tx: Transaction) => {
      log.d('Peer received transaction from ApEntity');
      this.emit('foreignTx', tx);
    });
  }

  private registerPoolEvents(this: Peer): void {
    this.on('selfOrRelayBlock', (block: Block) => {
      log.d('Peer received self or relayed block from P2pPool');
      this.apEntity.emit('selfOrRelayBlock', block);
    });
    this.on('selfTx', (tx: Transaction) => {
      log.d('Peer received transaction from P2pPool');
      this.apEntity.emit('selfTx', tx);
    });
  }
}
