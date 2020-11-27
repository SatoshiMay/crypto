import {FullNode} from './fullnode';
import {Logger} from './utils/logger';

const log = new Logger(`APP_INDEX_${process.pid}`);

const fullnode = new FullNode();

fullnode.start().catch(
    err => (log.e('Error starting fullnode: %O', err), process.exit(1)));
