import { NextFunction, Request, Response } from 'express';

import { catcher } from '../../utils/catcher';
import { EventEmitter } from 'events';

export const ee = new EventEmitter();

async function _getMiner(req: Request, res: Response, next: NextFunction) {
  res.send('Hello from Miner');
  ee.emit('mine');
}

export const getMiner = catcher(_getMiner);
