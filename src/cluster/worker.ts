import cluster from 'cluster';

import {FullNode} from '../fullnode';
import {Logger} from '../utils/logger';

import {Controller} from './controller';

const log = new Logger(`APP_WORKER_${process.pid}`);

export class Worker {
  constructor() {}

  static exec(): void {
    log.a(`Worker ${process.pid} started`);
    this.registerEvents();

    const fullnode = new FullNode();

    fullnode.start().catch(
        err => (log.e('Error starting fullnode: %O', err), process.exit(1)));
  }

  private static registerEvents(): void {
    cluster.worker.on('message', (m, h) => Controller.handle(m));
  }
}
