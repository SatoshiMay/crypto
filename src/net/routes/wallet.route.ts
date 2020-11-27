import express from 'express';

import * as ctrl from '../controllers/wallet.controller';
import * as val from '../validators/wallet.validator';

export const router = express.Router();

router.get('/accounts', val.getAccounts, ctrl.getAccounts);

router.get('/accounts/:username', val.getAccount, ctrl.getAccount);

router.get('/accounts/:username/balance', val.getBalance, ctrl.getBalance);

router.post('/accounts', val.postAccount, ctrl.postAccount);

router.post('/accounts/transaction', val.postTransaction, ctrl.postTransaction);
