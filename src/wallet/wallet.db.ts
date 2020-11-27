import assert from 'assert';
import {InsertWriteOpResult, UpdateWriteOpResult} from 'mongodb';

import {CoinBase} from '../coins/coinbase';
import {Outpoint, Transaction} from '../coins/transaction';
import {assertNever} from '../utils/error';
import {hasDuplicates} from '../utils/hasDuplicates';
import {Logger} from '../utils/logger';
import {Omit} from '../utils/type-mappings';

import {AccountColl, AccountDocument, DepositColl, DepositDocument} from './wallet.model';

export type Account = Omit<AccountDocument, '_id'>;

const log = new Logger(`APP_WALLETDB_${process.pid}`);

export class WalletDB {
  constructor() {}

  static async deposit(x: CoinBase|Transaction, state: 'unspent'|'pending'):
      Promise<InsertWriteOpResult|undefined> {
    const pubKeys = [];
    for (const output of x.outputs) pubKeys.push(output.script);

    assert(!hasDuplicates(pubKeys), `pubKeys has duplicates,\nx: ${x}`);

    const accounts = await AccountColl()
                         .find({pubKey: {$in: pubKeys}})
                         .limit(pubKeys.length)
                         .toArray();

    if (!accounts.length) return;

    const deposits: Array<Omit<DepositDocument, '_id'>> = [];
    accounts.forEach(account => {
      const index =
          x.outputs.findIndex(output => output.script === account.pubKey);
      assert(
          index > -1,
          `Could not find account in output,\naccount: ${account},\nx: ${x}`);

      const deposit: Omit<DepositDocument, '_id'> = {
        value: x.outputs[index].value,
        accountRef: account._id,
        // reference: {hash: x.txid, index},
        reference: {hash: x.id, outNum: index},
        state
      };
      deposits.push(deposit);
    });
    return DepositColl().insertMany(deposits);
  }

  static async expense(tx: Transaction): Promise<UpdateWriteOpResult> {
    const refs = [];
    for (const input of tx.inputs) {
      const ref: DepositDocument['reference'] = {
        hash: input.prevOut.hash,
        outNum: input.prevOut.outNum
      };
      refs.push(ref);
    }

    const result = await DepositColl().updateMany(
        {reference: {$in: refs}}, {$set: {state: 'spent'}});

    if (!(result.result.ok === 1))
      log.e(
          `Block confirmation failed in wallet,\ntx:${tx},\nresult: ${result}`);

    return result;
  }

  static async getOutptsAndExcess(pubKey: string, value: number):
      Promise<{outpoints: Outpoint[] | null, excess: number|null}> {
    assert(value > 0, `Value: ${value} must be positive`);

    const account = await AccountColl().findOne({pubKey});
    if (!account)
      return assertNever(
          pubKey as never,
          `In getting UTXO, could not find account for pubKey: '${pubKey}'`);

    let acc = 0;
    const outpoints: Outpoint[] = [];
    while (acc < value) {
      const deposit = await DepositColl().findOneAndUpdate(
          {accountRef: account._id, state: 'unspent'},
          {$set: {state: 'pending'}},
          // See mongodb-nodejs-native issue NODE-1421 at:-
          // https://jira.mongodb.org/browse/NODE
          // @ts-ignore
          {promoteBuffers: true});

      if (!deposit.value) return {outpoints: null, excess: null};

      acc += deposit.value.value;
      const outpt: Outpoint = {
        hash: deposit.value.reference.hash,
        outNum: deposit.value.reference.outNum
      };
      outpoints.push(outpt);
    }
    const excess = acc - value;
    return {outpoints, excess};
  }

  static async createAccount(opts: {username: string, pubKey: string}):
      Promise<{username: string, pubKey: string}> {
    const {username, pubKey} = opts;
    const insertOne = await AccountColl().insertOne({username, pubKey});
    if (!insertOne.result.ok)
      log.e('Wallet error while creating account, result: %O', insertOne);
    return {username, pubKey};
  }

  static async getAddress(username: string): Promise<string|null> {
    const account = await AccountColl().findOne({username});

    if (!account)
      return null;
    else
      return account.pubKey;
  }

  static getAccounts(): Promise<Account[]> {
    return AccountColl()
        .find<Account>({})
        .project({username: 1, pubKey: 1, _id: 0})
        .toArray();
  }

  static getAccount(username: string): Promise<Account|null> {
    return AccountColl().findOne<Account>(
        {username}, {projection: {username: 1, pubKey: 1, _id: 0}});
  }

  static async getBalance(username: string): Promise<number|null> {
    const account = await AccountColl().findOne({username});
    if (!account) return null;

    const deposits =
        await DepositColl()
            .find<{value: number}>({accountRef: account._id, state: 'unspent'})
            .project({value: 1})
            .toArray();
    return deposits.reduce((acc, payment) => acc + payment.value, 0);
  }
}
