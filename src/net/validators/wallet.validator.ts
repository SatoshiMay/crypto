import Joi from 'joi';

import {asyncMiddleware, catcher} from '../../utils/catcher';
import {validate} from '../../utils/validate';

const _getAccountsSchema = Joi.object().keys(undefined);
const _getAccountSchema = Joi.object().keys(undefined);
const _getBalanceSchema = Joi.object().keys(undefined);
const _postAccountSchema = Joi.object().keys(undefined);
const _postTransactionSchema = Joi.object().keys({
  body: {
    from: Joi.string().required(),
    to: Joi.string().required(),
    value: Joi.number().positive().required()
  }
}).unknown();

export const getAccounts: asyncMiddleware =
    catcher(validate(_getAccountsSchema));
export const getAccount: asyncMiddleware = catcher(validate(_getAccountSchema));
export const getBalance: asyncMiddleware = catcher(validate(_getBalanceSchema));
export const postAccount: asyncMiddleware =
    catcher(validate(_postAccountSchema));
export const postTransaction: asyncMiddleware =
    catcher(validate(_postTransactionSchema));
