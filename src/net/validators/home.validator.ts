import Joi from 'joi';

import { catcher, asyncMiddleware } from '../../utils/catcher';
import { validate } from '../../utils/validate';

const _getHomeSchema = Joi.object().keys(undefined);

export const getHome: asyncMiddleware = catcher(validate(_getHomeSchema));
