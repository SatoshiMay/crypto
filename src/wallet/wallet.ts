import {EventEmitter} from 'events';
import uuid from 'uuid/v4';

import {Block} from '../blockchain/block';
import {CoinBase} from '../coins/coinbase';
import {Transaction} from '../coins/transaction';
import {Logger, tree} from '../utils/logger';

import {Account, WalletDB} from './wallet.db';

const log = new Logger(`APP_WALLET_${process.pid}`);

export class Wallet {
  static ee = new EventEmitter();

  constructor() {}

  static init(): void {
    this.registerEvents();
  }

  static async createTx(to: string, from: string, value: number):
      Promise<void> {
    const [fromPk, toPk] =
        await Promise.all([this.getAddress(to), this.getAddress(from)]);

    if (fromPk && toPk) {
      const {outpoints, excess} =
          await WalletDB.getOutptsAndExcess(fromPk, value);
      if (outpoints === null)
        log.e('Wallet does not have sufficient funds');
      else {
        const inputs = outpoints.map(outpoint => ({from: fromPk, outpoint}));
        const outputs = [{to: toPk, amount: value}];
        if (excess! > 0) outputs.push({to: fromPk, amount: excess!});

        const tx = Transaction.fromTransfers({inputs, outputs});
        log.d('Wallet created transaction');

        this.ee.emit('selfTx', tx);
      }
    } else
      throw new Error('Unknown address');
  }

  private static confirmXpenses(block: Block): void {
    for (const tx of block.transactions)
      WalletDB.expense(tx).catch(
          err => log.e(
              'Wallet received error when cofirming block: %s,\nerr: %O',
              tree(tx), err));
  }

  private static createDeposits(block: Block): void;
  private static createDeposits(
      tx: Transaction|CoinBase, state: 'unspent'|'pending'): void;
  private static createDeposits(
      x: Block|Transaction|CoinBase, state?: 'unspent'|'pending'): void {
    if (x instanceof Block)
      for (const el of [x.coinbase, ...x.transactions])
        this.createDeposits(el, 'unspent');
    else
      WalletDB.deposit(x, state!).catch(
          err => log.e(
              'Wallet received error when depositing block: %s,\nerr: %O',
              tree(x), err));
  }

  static getAddress(username: string): Promise<string|null> {
    return WalletDB.getAddress(username);
  }

  static getAccounts(): Promise<Account[]> {
    return WalletDB.getAccounts();
  }

  static getAccount(username: string): Promise<Account|null> {
    return WalletDB.getAccount(username);
  }

  static getBalance(username: string): Promise<number|null> {
    return WalletDB.getBalance(username);
  }

  static createAccount(username: string): Promise<Account> {
    const pubKey = uuid();
    return WalletDB.createAccount({username, pubKey});
  }

  private static handleBlock(block: Block): void {
    this.createDeposits(block);
    this.confirmXpenses(block);
  }

  private static handleTx(tx: Transaction): void {
    this.createDeposits(tx, 'pending');
  }

  private static registerEvents(): void {
    this.ee.on('block', (block: Block) => {
      log.d('Wallet received saved block from Chain');
      this.handleBlock(block);
    });

    this.ee.on('foreignTx', (tx: Transaction) => {
      log.d('Wallet received transaction from P2pPool');
      this.handleTx(tx);
    });
  }
}
