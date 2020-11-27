import {ObjectId} from 'bson';
import {URL} from 'url';
import uuid from 'uuid/v4';

import {InsertCommit, UpdateManyCommit} from '../../src/database/commit';
import {Database} from '../../src/database/database';
import {Tpc} from '../../src/database/tpc';
import {TpcColl, TpcDocument} from '../../src/database/tpc.model';
import {tree} from '../../src/utils/logger';

const mongoUrl = new URL(process.env.MONGO_URL_PREFIX! + '-' + uuid());
const mongoOpts = {
  useNewUrlParser: true,
  promoteBuffers: true
};

interface AddressDocument {
  city: string;
  _id: ObjectId;
}

interface UserDocument {
  name: string;
  _id: ObjectId;
  addressRef: ObjectId;
}

// tslint:disable:variable-name
const AddressColl = Database.model<AddressDocument>('Addresses').collection;
const UserColl = Database.model<UserDocument>('Users').collection;

describe('Two Phase Commits', () => {
  beforeAll(() => Database.connect(mongoUrl, mongoOpts));

  beforeEach(() => Database.drop());

  afterAll(() => Database.drop().then(() => Database.disconnect()));

  test('toDoc method', () => {
    expect.assertions(5);
    const address = [
      {city: 'san diego', _id: new ObjectId()},
      {city: 'la', _id: new ObjectId()}
    ];
    const user = [
      {name: 'satoshi', _id: new ObjectId(), addressRef: address[0]._id},
      {name: 'may', _id: new ObjectId(), addressRef: address[1]._id}
    ];
    const addressCommit = new InsertCommit(AddressColl(), address);
    const userCommit = new InsertCommit(UserColl(), user);
    const tpc = new Tpc();
    tpc.commit(addressCommit).commit(userCommit);
    // @ts-ignore
    const {_id, state, commits, lastModified} = tpc;
    // @ts-ignore
    const tpcDocument = tpc.toDoc();

    expect(Object.keys(tpcDocument).length).toEqual(4);
    expect(tpcDocument).toHaveProperty('_id', _id);
    expect(tpcDocument).toHaveProperty('state', state);
    expect(tpcDocument).toHaveProperty('commitDocs', [
      ...commits
    ].map(commit => commit.toDoc()));
    expect(tpcDocument).toHaveProperty('lastModified', lastModified);
  });

  describe('Insert One', () => {
    test('run method', async () => {
      expect.assertions(5);
      const addressId = new ObjectId();
      const address = {city: 'san diego', _id: addressId};
      const user = {
        name: 'satoshi',
        _id: new ObjectId(),
        addressRef: addressId
      };
      const addressCommit = new InsertCommit(AddressColl(), address);
      const userCommit = new InsertCommit(UserColl(), user);
      const tpc = new Tpc();
      await tpc.commit(addressCommit).commit(userCommit).run();

      expect(await AddressColl().countDocuments({})).toEqual(1);
      expect(await UserColl().countDocuments({})).toEqual(1);

      const savedAddress = await AddressColl().findOne({});
      const savedUser = await UserColl().findOne({});

      expect(savedAddress).toEqual(address);
      expect(savedUser).toEqual(user);
      expect(await TpcColl().countDocuments({})).toEqual(0);
    });
  });

  describe('Insert Many', () => {
    let address: AddressDocument[], user: UserDocument[];
    let addressCommit: InsertCommit<AddressDocument>;
    let userCommit: InsertCommit<UserDocument>;
    let tpc: Tpc;
    beforeEach(() => {
      address = [
        {city: 'san diego', _id: new ObjectId()},
        {city: 'la', _id: new ObjectId()}
      ];
      user = [
        {name: 'satoshi', _id: new ObjectId(), addressRef: address[0]._id},
        {name: 'may', _id: new ObjectId(), addressRef: address[1]._id}
      ];
    });

    describe('Tpc API testing', () => {
      beforeEach(() => {
        addressCommit = new InsertCommit(AddressColl(), address);
        userCommit = new InsertCommit(UserColl(), user);

        tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
      });

      test('run method', async () => {
        expect.assertions(7);
        await tpc.run();

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const savedAddress0 = await AddressColl().findOne({city: 'san diego'});
        const savedUser0 = await UserColl().findOne({name: 'satoshi'});

        expect(savedAddress0).toEqual(address[0]);
        expect(savedUser0).toEqual(user[0]);

        const savedAddress1 = await AddressColl().findOne({city: 'la'});
        const savedUser1 = await UserColl().findOne({name: 'may'});

        expect(savedAddress1).toEqual(address[1]);
        expect(savedUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('runToPending method', async () => {
        expect.assertions(9);
        // @ts-ignore: private
        await tpc.runTpcInsert();
        // @ts-ignore: private
        await tpc.runToPending();

        expect(await TpcColl().countDocuments({})).toEqual(1);
        expect(await AddressColl().countDocuments({})).toEqual(0);
        expect(await UserColl().countDocuments({})).toEqual(0);

        const found = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;

        expect(Object.keys(found!).length).toEqual(4);
        expect(found).toHaveProperty('_id', _id);
        expect(found).toHaveProperty('state', 'pending');
        expect(found).toHaveProperty(
            'commitDocs', [...commits].map(commit => commit.toDoc()));
        expect(found).toHaveProperty('lastModified');
        expect(found!.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());
      });

      test('runToApplied method', async () => {
        expect.assertions(15);
        const tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
        // @ts-ignore: private
        await tpc.runTpcInsert();
        // @ts-ignore: private
        await tpc.runToPending();
        // @ts-ignore: private
        await tpc.runToApplied();

        expect(await TpcColl().countDocuments({})).toEqual(1);
        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        expect(await UserColl().countDocuments({})).toEqual(user.length);

        const foundTpc = await TpcColl().findOne({});
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;

        expect(Object.keys(foundTpc!).length).toEqual(4);
        expect(foundTpc).toHaveProperty('_id', _id);
        expect(foundTpc).toHaveProperty('state', 'applied');
        expect(foundTpc).toHaveProperty(
            'commitDocs', [...commits].map(commit => commit.toDoc()));
        expect(foundTpc).toHaveProperty('lastModified');
        expect(foundTpc!.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        expect(await AddressColl().countDocuments({})).toEqual(2);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();

        expect(foundAddress0).toEqual({
          ...address[0],
          // @ts-ignore
          __id__: addressCommit.doc[0].__id__,
          '__tId__': _id
        });
        expect(foundAddress1).toEqual({
          ...address[1],
          // @ts-ignore
          __id__: addressCommit.doc[1].__id__,
          '__tId__': _id
        });

        expect(await UserColl().countDocuments({})).toEqual(2);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();

        expect(foundUser0).toEqual({
          ...user[0],
          // @ts-ignore
          __id__: userCommit.doc[0].__id__,
          '__tId__': _id
        });
        expect(foundUser1).toEqual({
          ...user[1],
          // @ts-ignore
          __id__: userCommit.doc[1].__id__,
          '__tId__': _id
        });
      });

      test('runToDone method', async () => {
        expect.assertions(8);
        const tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
        // @ts-ignore: private
        await tpc.runTpcInsert();
        // @ts-ignore: private
        await tpc.runToPending();
        // @ts-ignore: private
        await tpc.runToApplied();
        // @ts-ignore: private
        await tpc.runToDone();

        expect(await TpcColl().countDocuments({})).toEqual(0);
        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        expect(await UserColl().countDocuments({})).toEqual(user.length);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();

        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();

        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });
    });

    describe('Tpc recovery', () => {
      let tpcDocument: TpcDocument;
      beforeEach(async () => {
        addressCommit = new InsertCommit(AddressColl(), address);
        userCommit = new InsertCommit(UserColl(), user);
        tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);

        // @ts-ignore: private
        await tpc.runTpcInsert();
      });

      test('Recovery from Tpc in initial state', async () => {
        expect.assertions(8);

        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        expect(tpcDocument).toHaveProperty('state', 'initial');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recovery from Tpc in pending state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        expect(tpcDocument).toHaveProperty('state', 'pending');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recovery from Tpc in applied state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        tpcDocument = (await TpcColl().findOne({}))!;
        expect(tpcDocument).toHaveProperty('state', 'applied');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recovery from Tpc in applied state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        tpcDocument = (await TpcColl().findOne({}))!;
        expect(tpcDocument).toHaveProperty('state', 'applied');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recover with multiple Tpc runs in initial state', async () => {
        expect.assertions(15);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToPending().catch(err => expect(err).toBeTruthy());
        expect(await TpcColl().countDocuments({})).toEqual(1);
        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;
        expect(Object.keys(tpcDocument!).length).toEqual(4);
        expect(tpcDocument).toHaveProperty('_id', _id);
        expect(tpcDocument).toHaveProperty('state', 'pending');
        expect(tpcDocument).toHaveProperty('commitDocs', [
          ...commits
        ].map(commit => commit.toDoc()));
        expect(tpcDocument).toHaveProperty('lastModified');
        expect(tpcDocument.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recover with multiple Tpc runs in pending state', async () => {
        expect.assertions(15);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        // @ts-ignore
        await tpc.runToApplied().catch(err => expect(err).toBeTruthy());
        expect(await TpcColl().countDocuments({})).toEqual(1);
        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;
        expect(Object.keys(tpcDocument!).length).toEqual(4);
        expect(tpcDocument).toHaveProperty('_id', _id);
        expect(tpcDocument).toHaveProperty('state', 'applied');
        expect(tpcDocument).toHaveProperty('commitDocs', [
          ...commits
        ].map(commit => commit.toDoc()));
        expect(tpcDocument).toHaveProperty('lastModified');
        expect(tpcDocument.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recover with multiple Tpc runs in applied state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        // @ts-ignore
        await tpc.runToDone();
        // @ts-ignore
        await tpc.runToDone().catch(err => expect(err).toBeTruthy());
        expect(await TpcColl().countDocuments({})).toEqual(0);

        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(await UserColl().countDocuments({})).toEqual(user.length);
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
      });
    });

    describe('Tpc recovery with partially successful document', () => {
      let tpcDocument: TpcDocument;
      beforeEach(async () => {
        addressCommit = new InsertCommit(AddressColl(), address);
        userCommit = new InsertCommit(UserColl(), user);
        tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);

        // @ts-ignore: private
        await tpc.runTpcInsert();
      });

      test(
          'Tpc in pending state with partially successfull document',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'initial');

            // insert users to mimic partially successfull run
            // @ts-ignore
            const __id__ = userCommit.doc.map(d => d.__id__);
            const saved = user.map(
                (u, index) =>
                    ({...u, __id__: __id__[index], __tId__: tpcDocument._id}));
            await UserColl().insertMany(saved);

            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({}))
                .toEqual(address.length);
            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            expect(foundAddress0).toEqual(address[0]);
            expect(foundAddress1).toEqual(address[1]);

            expect(await UserColl().countDocuments({})).toEqual(user.length);
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundUser0).toEqual(user[0]);
            expect(foundUser1).toEqual(user[1]);
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });

      test(
          'Tpc in pending state with partially successfull document II',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'initial');

            // insert user to mimic partially successfull run
            // @ts-ignore
            const __uid__ = userCommit.doc.map(d => d.__id__);
            const mimicedU = user.map(
                (u, index) =>
                    ({...u, __id__: __uid__[index], __tId__: tpcDocument._id}));
            await UserColl().insertOne(mimicedU[mimicedU.length - 1]);

            // insert address to mimic partially successfull run
            // @ts-ignore
            const __aid__ = addressCommit.doc.map(d => d.__id__);
            const mimicedA = address.map(
                (u, index) =>
                    ({...u, __id__: __aid__[index], __tId__: tpcDocument._id}));
            await AddressColl().insertOne(mimicedA[mimicedA.length - 1]);

            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({}))
                .toEqual(address.length);
            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            expect(foundAddress0).toEqual(address[0]);
            expect(foundAddress1).toEqual(address[1]);

            expect(await UserColl().countDocuments({})).toEqual(user.length);
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundUser0).toEqual(user[0]);
            expect(foundUser1).toEqual(user[1]);
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });

      test(
          'Tpc in applied state with partially successfull document',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            await tpc.runToPending();
            // @ts-ignore
            await tpc.runToApplied();
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'applied');

            // mimic partially successfull run
            AddressColl().updateMany({}, {$unset: {__id__: '', __tId__: ''}});
            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({}))
                .toEqual(address.length);
            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            expect(foundAddress0).toEqual(address[0]);
            expect(foundAddress1).toEqual(address[1]);

            expect(await UserColl().countDocuments({})).toEqual(user.length);
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundUser0).toEqual(user[0]);
            expect(foundUser1).toEqual(user[1]);
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });
    });
  });

  describe('Update Many', () => {
    let address: AddressDocument[], user: UserDocument[];
    let addressCommit: UpdateManyCommit<AddressDocument>;
    let userCommit: UpdateManyCommit<UserDocument>;
    let tpc: Tpc;
    beforeEach(async () => {
      address = [
        {city: 'san diego', _id: new ObjectId()},
        {city: 'la', _id: new ObjectId()}
      ];
      user = [
        {name: 'satoshi', _id: new ObjectId(), addressRef: address[0]._id},
        {name: 'may', _id: new ObjectId(), addressRef: address[1]._id}
      ];
    });

    describe('Tpc API testing', () => {
      beforeEach(async () => {
        await AddressColl().insertMany(address);
        await UserColl().insertMany(user);
        addressCommit = new UpdateManyCommit(
            AddressColl(), {}, {$set: {state: 'CA'}, $inc: {counter: 1}});
        userCommit = new UpdateManyCommit(
            UserColl(), {}, {$set: {sex: 'male'}, $inc: {counter: 1}});

        tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
      });

      test('run method', async () => {
        expect.assertions(7);
        await tpc.run();

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});

        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('runToPending method', async () => {
        expect.assertions(15);
        // @ts-ignore: private
        await tpc.runTpcInsert();
        // @ts-ignore: private
        await tpc.runToPending();

        expect(await TpcColl().countDocuments({})).toEqual(1);
        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        expect(await UserColl().countDocuments({})).toEqual(user.length);

        const found = await TpcColl().findOne({});
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;

        expect(Object.keys(found!).length).toEqual(4);
        expect(found).toHaveProperty('_id', _id);
        expect(found).toHaveProperty('state', 'pending');
        expect(found).toHaveProperty(
            'commitDocs', [...commits].map(commit => commit.toDoc()));
        expect(found).toHaveProperty('lastModified');
        expect(found!.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();

        expect(foundAddress0).toEqual(address[0]);
        expect(foundAddress1).toEqual(address[1]);

        expect(foundUser0).toEqual(user[0]);
        expect(foundUser1).toEqual(user[1]);
      });

      test('runToApplied method', async () => {
        expect.assertions(15);
        const tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
        // @ts-ignore: private
        await tpc.runTpcInsert();
        // @ts-ignore: private
        await tpc.runToPending();
        // @ts-ignore: private
        await tpc.runToApplied();

        expect(await TpcColl().countDocuments({})).toEqual(1);
        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        expect(await UserColl().countDocuments({})).toEqual(user.length);

        const foundTpc = await TpcColl().findOne({});
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;

        expect(Object.keys(foundTpc!).length).toEqual(4);
        expect(foundTpc).toHaveProperty('_id', _id);
        expect(foundTpc).toHaveProperty('state', 'applied');
        expect(foundTpc).toHaveProperty(
            'commitDocs', [...commits].map(commit => commit.toDoc()));
        expect(foundTpc).toHaveProperty('lastModified');
        expect(foundTpc!.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();

        expect(foundAddress0)
            .toEqual({...address[0], state: 'CA', counter: 1, '__tId__': _id});
        expect(foundAddress1)
            .toEqual({...address[1], state: 'CA', counter: 1, '__tId__': _id});
        expect(foundUser0)
            .toEqual({...user[0], sex: 'male', counter: 1, '__tId__': _id});
        expect(foundUser1)
            .toEqual({...user[1], sex: 'male', counter: 1, '__tId__': _id});
      });

      test('runToDone method', async () => {
        expect.assertions(8);
        const tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
        // @ts-ignore: private
        await tpc.runTpcInsert();
        // @ts-ignore: private
        await tpc.runToPending();
        // @ts-ignore: private
        await tpc.runToApplied();
        // @ts-ignore: private
        await tpc.runToDone();

        expect(await TpcColl().countDocuments({})).toEqual(0);
        expect(await AddressColl().countDocuments({})).toEqual(address.length);
        expect(await UserColl().countDocuments({})).toEqual(user.length);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();

        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });
    });

    describe('Tpc recovery', () => {
      let tpcDocument: TpcDocument;
      beforeEach(async () => {
        await AddressColl().insertMany(address);
        await UserColl().insertMany(user);
        addressCommit = new UpdateManyCommit(
            AddressColl(), {}, {$set: {state: 'CA'}, $inc: {counter: 1}});
        userCommit = new UpdateManyCommit(
            UserColl(), {}, {$set: {sex: 'male'}, $inc: {counter: 1}});

        tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
        // @ts-ignore: private
        await tpc.runTpcInsert();
      });

      test('Recovery from Tpc in initial state', async () => {
        expect.assertions(8);

        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        expect(tpcDocument).toHaveProperty('state', 'initial');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();

        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recovery from Tpc in pending state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        expect(tpcDocument).toHaveProperty('state', 'pending');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recovery from Tpc in applied state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        tpcDocument = (await TpcColl().findOne({}))!;
        expect(tpcDocument).toHaveProperty('state', 'applied');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recovery from Tpc in applied state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        tpcDocument = (await TpcColl().findOne({}))!;
        expect(tpcDocument).toHaveProperty('state', 'applied');

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recover with multiple Tpc runs in initial state', async () => {
        expect.assertions(15);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToPending().catch(err => expect(err).toBeTruthy());
        expect(await TpcColl().countDocuments({})).toEqual(1);
        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;
        expect(Object.keys(tpcDocument!).length).toEqual(4);
        expect(tpcDocument).toHaveProperty('_id', _id);
        expect(tpcDocument).toHaveProperty('state', 'pending');
        expect(tpcDocument).toHaveProperty('commitDocs', [
          ...commits
        ].map(commit => commit.toDoc()));
        expect(tpcDocument).toHaveProperty('lastModified');
        expect(tpcDocument.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recover with multiple Tpc runs in pending state', async () => {
        expect.assertions(15);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        // @ts-ignore
        await tpc.runToApplied().catch(err => expect(err).toBeTruthy());
        expect(await TpcColl().countDocuments({})).toEqual(1);
        tpcDocument = (await TpcColl().findOne({}))!;
        // @ts-ignore: private
        const {_id, commits, lastModified} = tpc;
        expect(Object.keys(tpcDocument!).length).toEqual(4);
        expect(tpcDocument).toHaveProperty('_id', _id);
        expect(tpcDocument).toHaveProperty('state', 'applied');
        expect(tpcDocument).toHaveProperty('commitDocs', [
          ...commits
        ].map(commit => commit.toDoc()));
        expect(tpcDocument).toHaveProperty('lastModified');
        expect(tpcDocument.lastModified.getTime())
            .toBeGreaterThanOrEqual(lastModified.getTime());

        // recover
        await Tpc.recover(tpcDocument);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
        expect(await TpcColl().countDocuments({})).toEqual(0);
      });

      test('Recover with multiple Tpc runs in applied state', async () => {
        expect.assertions(8);

        // @ts-ignore
        await tpc.runToPending();
        // @ts-ignore
        await tpc.runToApplied();
        // @ts-ignore
        await tpc.runToDone();
        // @ts-ignore
        await tpc.runToDone().catch(err => expect(err).toBeTruthy());
        expect(await TpcColl().countDocuments({})).toEqual(0);

        expect(await AddressColl().countDocuments({})).toEqual(2);
        expect(await UserColl().countDocuments({})).toEqual(2);

        const [foundAddress0] =
            await AddressColl().find({city: 'san diego'}).toArray();
        const [foundAddress1] =
            await AddressColl().find({city: 'la'}).toArray();
        const [foundUser0] = await UserColl().find({name: 'satoshi'}).toArray();
        const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
        expect(foundAddress0).toEqual({...address[0], state: 'CA', counter: 1});
        expect(foundAddress1).toEqual({...address[1], state: 'CA', counter: 1});
        expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
        expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
      });
    });

    describe('Tpc recovery with partially successful document', () => {
      let tpcDocument: TpcDocument;
      beforeEach(async () => {
        await AddressColl().insertMany(address);
        await UserColl().insertMany(user);
        addressCommit = new UpdateManyCommit(
            AddressColl(), {}, {$set: {state: 'CA'}, $inc: {counter: 1}});
        userCommit = new UpdateManyCommit(
            UserColl(), {}, {$set: {sex: 'male'}, $inc: {counter: 1}});

        tpc = new Tpc();
        tpc.commit(addressCommit).commit(userCommit);
        // @ts-ignore: private
        await tpc.runTpcInsert();
      });

      test(
          'Tpc in pending state with partially successfull document',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'initial');
            // insert users to mimic partially successfull run
            await UserColl().updateMany({__tId__: {$ne: tpcDocument._id}}, {
              $set: {sex: 'male', __tId__: tpcDocument._id},
              $inc: {counter: 1}
            });

            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({})).toEqual(2);
            expect(await UserColl().countDocuments({})).toEqual(2);

            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundAddress0)
                .toEqual({...address[0], state: 'CA', counter: 1});
            expect(foundAddress1)
                .toEqual({...address[1], state: 'CA', counter: 1});
            expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
            expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });

      test(
          'Tpc in pending state with partially successfull document II',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'initial');
            // insert users to mimic partially successfull run
            await UserColl().updateOne({__tId__: {$ne: tpcDocument._id}}, {
              $set: {sex: 'male', __tId__: tpcDocument._id},
              $inc: {counter: 1}
            });

            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({})).toEqual(2);
            expect(await UserColl().countDocuments({})).toEqual(2);

            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundAddress0)
                .toEqual({...address[0], state: 'CA', counter: 1});
            expect(foundAddress1)
                .toEqual({...address[1], state: 'CA', counter: 1});
            expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
            expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });

      test(
          'Tpc in applied state with partially successfull document',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            await tpc.runToPending();
            // @ts-ignore
            await tpc.runToApplied();
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'applied');

            // mimic partially successfull run
            AddressColl().updateMany({}, {$unset: {__tId__: ''}});
            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({})).toEqual(2);
            expect(await UserColl().countDocuments({})).toEqual(2);

            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundAddress0)
                .toEqual({...address[0], state: 'CA', counter: 1});
            expect(foundAddress1)
                .toEqual({...address[1], state: 'CA', counter: 1});
            expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
            expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });
      test(
          'Tpc in applied state with partially successfull document II',
          async () => {
            expect.assertions(8);

            // @ts-ignore
            await tpc.runToPending();
            // @ts-ignore
            await tpc.runToApplied();
            tpcDocument = (await TpcColl().findOne({}))!;
            expect(tpcDocument).toHaveProperty('state', 'applied');

            // mimic partially successfull run
            AddressColl().updateOne({}, {$unset: {__tId__: ''}});
            // recover
            await Tpc.recover(tpcDocument);

            expect(await AddressColl().countDocuments({})).toEqual(2);
            expect(await UserColl().countDocuments({})).toEqual(2);

            const [foundAddress0] =
                await AddressColl().find({city: 'san diego'}).toArray();
            const [foundAddress1] =
                await AddressColl().find({city: 'la'}).toArray();
            const [foundUser0] =
                await UserColl().find({name: 'satoshi'}).toArray();
            const [foundUser1] = await UserColl().find({name: 'may'}).toArray();
            expect(foundAddress0)
                .toEqual({...address[0], state: 'CA', counter: 1});
            expect(foundAddress1)
                .toEqual({...address[1], state: 'CA', counter: 1});
            expect(foundUser0).toEqual({...user[0], sex: 'male', counter: 1});
            expect(foundUser1).toEqual({...user[1], sex: 'male', counter: 1});
            expect(await TpcColl().countDocuments({})).toEqual(0);
          });
    });
  });
});
