import bodyParser from 'body-parser';
import {EventEmitter} from 'events';
import express, {Express, NextFunction, Request, Response} from 'express';
import http from 'http';
import {AddressInfo} from 'net';

import {HttpError} from '../utils/error';
import {Logger} from '../utils/logger';

import * as chain from './routes/chain.route';
import * as home from './routes/home.route';
import * as mempool from './routes/mempool.route';
import * as miner from './routes/mine.route';
import * as wallet from './routes/wallet.route';

const log = new Logger(`APP_HTTP_SERVER_${process.pid}`);

export class HttpServer extends EventEmitter {
  private app: Express;
  private server: http.Server;

  constructor() {
    super();

    this.init();
  }

  private init(): void {
    this.createServer();
    this.mountRoutes();
    this.errorHandlers();
    this.routeEvents();
    this.serverEvents();
  }

  private createServer(): void {
    this.app = express();
    this.server = http.createServer(this.app);
  }

  private mountRoutes(): void {
    this.app.use(this.printProcessInfo);
    this.app.use(bodyParser.json());
    this.app.use('/', home.router);
    this.app.use('/mine', miner.router);
    this.app.use('/wallet', wallet.router);
    this.app.use('/chain', chain.router);
    this.app.use('/mempool', mempool.router);
  }

  private errorHandlers(): void {
    // catch 404 and forward to error handler
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const err = new HttpError(404, 'Not Found');
      next(err);
    });

    // error logger
    this.app.use(
        (err: any, req: Request, res: Response, next: NextFunction) => {
          if (!err.status || !([400, 401, 404].indexOf(err.status) > -1))
            log.e(err);
          next(err);
        });

    // send response
    this.app.use(
        (err: any, req: Request, res: Response, next: NextFunction) => {
          res.sendStatus(err.status || 500);
        });
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
        return resolve();
      });
    });
  }

  private serverEvents(): void {
    this.server.on('listening', () => {
      log.a('Http server listening on: ', this.server.address());
    });

    this.server.on('close', () => {
      log.a('Http server closed');
    });

    this.server.on('error', (err) => {
      log.e('Http server error: %O', err);
    });
  }

  private routeEvents(): void {
    miner.ee.on('mine', () => {
      this.emit('mine');
    });
  }

  private printProcessInfo(req: Request, res: Response, next: NextFunction):
      void {
    log.d(`Handled by process: ${process.pid}`);
    return next();
  }
}
