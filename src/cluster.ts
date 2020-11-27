import cluster from 'cluster';

import {Master} from './cluster/master';
import {Worker} from './cluster/worker';

if (cluster.isMaster)
  Master.exec();
else
  Worker.exec();
