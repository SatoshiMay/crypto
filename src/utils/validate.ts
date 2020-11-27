import {NextFunction, Request, Response} from 'express';
import {ObjectSchema as JoiSchema} from 'joi';

import {HttpError} from './error';

type validate = (schema: JoiSchema) =>
    (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const validate: validate = schema => async (req, res, next) => {
  const {error} = schema.validate(req);

  if (error) return next(new HttpError(400, error.message));

  return next();
};
