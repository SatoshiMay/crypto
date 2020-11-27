import assert from 'assert';
import {EventEmitter} from 'events';
import {IncomingMessage} from 'http';
import WebSocket, {OPEN} from 'ws';

import {Block} from '../blockchain/block';
import {Transaction} from '../coins/transaction';
import {Logger} from '../utils/logger';

import {Peer} from './peer';

const log = new Logger(`APP_P2P_POOL_${process.pid}`);

export class P2PPool extends EventEmitter {
  pool: Set<Peer>;

  constructor() {
    super();

    this.pool = new Set<Peer>();
    this.init();
  }

  private init() {
    this.registerEvents();
    // this.connectToPeers(
    //     opts ? opts.peerUrls ? opts.peerUrls : undefined : undefined);
  }

  start(urls?: string[]): Promise<void> {
    const peers$ = this.connectToPeers(urls);
    if (peers$ instanceof Array)
      return Promise.all(peers$).then(_ => {});
    else
      return Promise.resolve();
  }

  stop(): Promise<void> {
    const stops$ = [];
    for (const peer of this.pool.values())
      stops$.push(new Promise<void>((resolve, reject) => {
        peer.close();
        peer.on('close', () => resolve());
      }));

    return Promise.all(stops$).then(_ => {});
  }

  // private connectToPeers(urls: string[]|undefined): void {
  // const peerUrls = [];
  // if (process.env.P2P_PEERS)
  //   peerUrls.push(...process.env.P2P_PEERS.split(','));
  // else if (urls)
  //   peerUrls.push(...urls);
  // else
  //   log.a('No peers specified to connect to');

  // peerUrls.forEach(this.createOutbound, this);
  // }
  private connectToPeers(urls?: string[]): Array<Promise<Peer>>|Promise<void> {
    if (urls && urls.length) {
      const peers$ = urls.map(this.createOutbound, this)
                         .map(peer => new Promise<Peer>((resolve, reject) => {
                                peer.on('error', err => reject(err));
                                peer.on('open', () => resolve(peer));
                              }));
      return peers$;
    } else {
      log.a('No peers specified to connect to');
      return Promise.resolve();
    }
  }

  private createOutbound(this: P2PPool, url: string): Peer {
    const peer = Peer.fromRemoteUrl(url);
    this.registerPeerEvents(peer);
    return peer;
  }

  private createInbound(socket: WebSocket, req: IncomingMessage): void {
    const peer = Peer.fromInbound(socket, req);
    this.registerPeerEvents(peer);
    // peer will not emit open event so add imperatively
    if (peer.readyState === OPEN) this.addToPool(peer);
  }

  private relay(peer: Peer, block: Block) {
    this.pool.forEach(p => {
      if (p !== peer) p.emit('selfOrRelayBlock', block);
    });
  }

  private handleMiner(block: Block): void {
    this.pool.forEach((peer) => {
      peer.emit('selfOrRelayBlock', block);
    });
  }

  private handleWallet(tx: Transaction): void {
    this.pool.forEach((peer) => {
      peer.emit('selfTx', tx);
    });
  }

  private foreignBlock(peer: Peer, block: Block): void {
    log.d('P2pPool received block from Peer');
    this.emit('foreignBlock', block);
    this.relay(peer, block);
  }

  private registerPeerEvents(peer: Peer): void {
    peer.on('error', (error) => log.e('Peer emitted error:\n%O', error));
    peer.on('open', () => this.addToPool(peer));
    peer.on('close', () => this.removeFromPool(peer));

    peer.on('foreignBlock', (block: Block) => {
      this.foreignBlock(peer, block);
    });

    peer.on('foreignTx', (tx: Transaction) => {
      log.d('P2pPool received transaction from Peer');
      this.emit('foreignTx', tx);
    });
  }

  private registerEvents(this: P2PPool): void {
    this.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      this.createInbound(socket, req);
    });
    this.on('selfBlock', (block: Block) => {
      log.d('P2pPool received block from Miner');
      this.handleMiner(block);
    });
    this.on('selfTx', (tx: Transaction) => {
      log.d('P2pPool received transaction from Wallet');
      this.handleWallet(tx);
    });
  }

  private addToPool(peer: Peer) {
    assert(!this.pool.has(peer));
    this.pool.add(peer);
    log.d('P2P pool size: ', this.pool.size);
  }

  private removeFromPool(peer: Peer) {
    // assert(this.pool.has(peer));
    this.pool.delete(peer);
    log.d('P2P pool size: ', this.pool.size);
  }
}
