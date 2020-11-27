import {URL} from 'url';
import uuid from 'uuid/v4';

import {Database} from '../../src/database/database';
import {Wallet} from '../../src/wallet/wallet';
import {AccountColl} from '../../src/wallet/wallet.model';

const mongoUrl = new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid());
const mongoOpts = {
  useNewUrlParser: true,
  promoteBuffers: true
};

describe('Wallet', () => {
  beforeAll(() => Database.connect(mongoUrl, mongoOpts));

  beforeEach(() => Database.drop());

  afterAll(() => Database.drop().then(() => Database.disconnect()));

  test('Create an account', async () => {
    expect.assertions(3);
    const username = 'test_user';
    await Wallet.createAccount(username);
    expect(await AccountColl().countDocuments({})).toEqual(1);
    const account = await AccountColl().findOne({});
    expect(account!.username).toEqual(username);
    expect(account!.pubKey).toBeTruthy();
  });
});
