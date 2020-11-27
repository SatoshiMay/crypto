import Joi from 'joi';

import { catcher, asyncMiddleware } from '../../utils/catcher';
import { validate } from '../../utils/validate';

const _getChainSchema = Joi.object().keys(undefined);

export const getChain: asyncMiddleware = catcher(validate(_getChainSchema));
