import {NextFunction, Request, Response} from 'express';

import {Mempool} from '../../coins/mempool';
import {catcher} from '../../utils/catcher';

async function _getTxIds(req: Request, res: Response, next: NextFunction) {
  const blocks = await Mempool.txIds;
  res.json(blocks);
}

export const getTxs = catcher(_getTxIds);
