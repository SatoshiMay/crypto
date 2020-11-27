import {NextFunction, Request, Response} from 'express';

import {catcher} from '../../utils/catcher';
import {Wallet} from '../../wallet/wallet';

async function _getAccounts(req: Request, res: Response, next: NextFunction) {
  const accounts = await Wallet.getAccounts();
  res.json(accounts);
}

async function _getAccount(req: Request, res: Response, next: NextFunction) {
  const account = await Wallet.getAccount(req.params.username);
  res.json(account);
}

async function _getBalance(req: Request, res: Response, next: NextFunction) {
  const balance = await Wallet.getBalance(req.params.username);
  res.json(balance);
}

async function _postAccount(req: Request, res: Response, next: NextFunction) {
  const account = await Wallet.createAccount(req.body.username);
  res.json(account);
}

async function _postTransaction(
    req: Request, res: Response, next: NextFunction) {
  await Wallet.createTx(req.body.from, req.body.to, req.body.value);
  res.json('');
}

export const getAccounts = catcher(_getAccounts);
export const getAccount = catcher(_getAccount);
export const getBalance = catcher(_getBalance);
export const postAccount = catcher(_postAccount);
export const postTransaction = catcher(_postTransaction);
