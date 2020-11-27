import assert from 'assert';
import cluster from 'cluster';
import os from 'os';

import {Logger} from '../utils/logger';

import {Controller} from './controller';
import {Message} from './message';

// Only works for Node.js >= v6.0. See
// https://nodejs.org/api/cluster.html#cluster_event_message_1
assert(
    +process.version.slice(1, 2) >= 6,
    `Expected Node.js version later than v6.0 but received ${process.version}`);

const log = new Logger(`APP_MASTER_${process.pid}`);

const numCPUs = os.cpus().length;

export class Master {
  constructor() {}

  static exec(): void {
    this.spawn();
    this.registerEvents();
  }

  private static spawn(): void {
    log.a(`Master ${process.pid} is running...starting ${numCPUs} workers`);

    for (let i = 0; i < numCPUs; i++) cluster.fork();
  }

  private static registerEvents(): void {
    cluster.on('message', (w, m, h) => Controller.handle(m));
    cluster.on('exit', worker => log.a(`worker ${worker.process.pid} died`));
  }
}
