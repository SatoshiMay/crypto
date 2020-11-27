import {NextFunction, Request, Response} from 'express';

import {catcher} from '../../utils/catcher';

async function _getHome(req: Request, res: Response, next: NextFunction) {
  res.send('Hello from Home');
}

export const getHome = catcher(_getHome);
