import {NextFunction, Request, Response} from 'express';

export type asyncMiddleware =
    (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const catcher = (asyncFn: asyncMiddleware) =>
    (req: Request, res: Response, next: NextFunction) =>
        asyncFn(req, res, next).catch(next);
