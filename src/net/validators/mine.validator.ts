import Joi from 'joi';

import { catcher, asyncMiddleware } from '../../utils/catcher';
import { validate } from '../../utils/validate';

const _getMinerSchema = Joi.object().keys(undefined);

export const getMiner: asyncMiddleware = catcher(validate(_getMinerSchema));
