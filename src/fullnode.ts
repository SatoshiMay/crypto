import {IncomingMessage} from 'http';
import {MongoClientOptions} from 'mongodb';
import {URL} from 'url';
import WebSocket from 'ws';

import config from './appconfig';
import {Block} from './blockchain/block';
import {Chain} from './blockchain/chain';
import {Mempool} from './coins/mempool';
import {Transaction} from './coins/transaction';
import {Database} from './database/database';
import {Tpc} from './database/tpc';
import {Miner} from './mine/miner';
import {HttpServer} from './net/http-server';
import {P2PPool} from './net/p2p-pool';
import {P2PServer} from './net/p2p-server';
import {Wallet} from './wallet/wallet';

interface StartOptions {
  mongoUrl: URL;
  mongoOpts: MongoClientOptions;
  p2pPort?: number;
  peerUrls?: string[];
  httpPort?: number;
}

export class FullNode {
  readonly mempool: Mempool;
  private readonly p2pServer: P2PServer;
  private readonly p2pPool: P2PPool;
  private readonly httpServer: HttpServer;
  private readonly chain: Chain;
  private readonly miner: Miner;

  constructor() {
    this.mempool = new Mempool();
    this.p2pServer = new P2PServer();
    this.p2pPool = new P2PPool();
    this.httpServer = new HttpServer();
    this.chain = new Chain();
    this.miner = new Miner(Mempool.pending);
    this.init();
  }

  private get options(): StartOptions {
    const httpPort = +(process.env.HTTP_PORT || 3000);
    const p2pPort = +(process.env.WEBSOCKET_PORT || 8333);
    const peerUrls: string[] = [];

    if (process.env.P2P_PEERS)
      peerUrls.push(...process.env.P2P_PEERS.split(','));

    else if (config.p2pPool ? config.p2pPool.peerUrls : undefined)
      peerUrls.push(...config.p2pPool.peerUrls);

    const env = process.env.NODE_ENV || 'dev';
    const mongoUrl = new URL(process.env.MONGODB_URL || config.db.uri[env]);
    const mongoOpts = config.db.options;

    return {p2pPort, peerUrls, httpPort, mongoUrl, mongoOpts};
  }

  private init(): void {
    Wallet.init();
    this.registerEvents();
  }

  async start(options?: StartOptions): Promise<StartOptions> {
    let opts: StartOptions;
    if (options)
      opts = options;
    else
      opts = this.options;

    await Database.connect(opts.mongoUrl, opts.mongoOpts);
    await Tpc.recover();
    await this.chain.start();
    await this.miner.start();
    const _p2pPort = await this.p2pServer.start(opts.p2pPort);
    await this.p2pPool.start(opts.peerUrls);
    const _httpPort = await this.httpServer.start(opts.httpPort);
    return {
      mongoUrl: opts.mongoUrl,
      mongoOpts: opts.mongoOpts,
      p2pPort: _p2pPort,
      peerUrls: opts.peerUrls,
      httpPort: _httpPort
    };
  }

  async stop(): Promise<void> {
    await this.httpServer.stop();
    await this.p2pPool.stop();
    await this.p2pServer.stop();
    await Database.disconnect();
  }

  private registerEvents(): void {
    // mined block
    this.miner.on('block', (block: Block) => {
      this.chain.emit('selfBlock', block);
      this.p2pPool.emit('selfBlock', block);
    });

    // block from network
    this.p2pPool.on('foreignBlock', (block: Block) => {
      this.chain.emit('foreignBlock', block);
    });

    // self and foreign block verified by chain
    this.chain.on('savedBlock', (block: Block) => {
      this.mempool.emit('block', block);
      Wallet.ee.emit('block', block);
    });

    // transaction from wallet
    Wallet.ee.on('selfTx', (tx: Transaction) => {
      this.mempool.emit('selfTx', tx);
      this.p2pPool.emit('selfTx', tx);
    });

    // transaction from network
    this.p2pPool.on('foreignTx', (tx: Transaction) => {
      this.mempool.emit('foreignTx', tx);
    });

    // foreign transaction verified by mempool
    this.mempool.on('verfifiedTx', (tx: Transaction) => {
      Wallet.ee.emit('foreignTx', tx);
    });

    // incoming ws connection to server
    this.p2pServer.on(
        'connection', (socket: WebSocket, req: IncomingMessage) => {
          this.p2pPool.emit('connection', socket, req);
        });

    // request to mine
    this.httpServer.on('mine', () => {
      this.miner.emit('mine');
    });
  }
}
