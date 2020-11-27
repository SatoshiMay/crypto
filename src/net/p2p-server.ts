import {EventEmitter} from 'events';
import {IncomingMessage} from 'http';
import http from 'http';
import {AddressInfo} from 'net';
import WebSocket from 'ws';

import {Logger} from '../utils/logger';

const log = new Logger(`APP_P2P_SERVER_${process.pid}`);

export class P2PServer extends EventEmitter {
  private wsServer: WebSocket.Server;
  private server: http.Server;

  constructor() {
    super();
    this.init();
  }

  private init() {
    this.createServer();
    this.registerEvents();
  }

  private createServer(): void {
    this.server = http.createServer();
    this.wsServer = new WebSocket.Server({server: this.server});
  }

  start(port?: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (port)
        this.server.listen(
            port, () => resolve((this.server.address() as AddressInfo).port));
      else
        this.server.listen(
            () => resolve((this.server.address() as AddressInfo).port));
    });
  }

  stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.close((err?: any) => {
        if (err) return reject(err);

        log.a(`P2P server closed`);
        return resolve();
      });
    });
  }

  private registerEvents(this: P2PServer) {
    this.wsServer.on('error', (error) => {
      log.e('P2P server error:\n%O', error);
    });

    this.wsServer.on('listening', () => {
      log.a('P2P server listening on: ', this.wsServer.address());
    });

    this.wsServer.on(
        'connection', (socket: WebSocket, req: IncomingMessage) => {
          log.a(
              'P2P server established incoming connection from: %s:%s',
              req.connection.remoteAddress, req.connection.remotePort);
          this.emit('connection', socket, req);
        });
  }
}
