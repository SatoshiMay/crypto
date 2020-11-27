import Joi from 'joi';

import { catcher, asyncMiddleware } from '../../utils/catcher';
import { validate } from '../../utils/validate';

const _getTxsSchema = Joi.object().keys(undefined);

export const getTxs: asyncMiddleware = catcher(validate(_getTxsSchema));
