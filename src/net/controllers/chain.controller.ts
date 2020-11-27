import { NextFunction, Request, Response } from 'express';

import { catcher } from '../../utils/catcher';
import { Chain } from '../../blockchain/chain';

async function _getChain(req: Request, res: Response, next: NextFunction) {
  const blocks = await Chain.getBlocks();
  res.json(blocks);
}

export const getChain = catcher(_getChain);
