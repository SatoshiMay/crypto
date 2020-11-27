import assert from 'assert';
import {Collection, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FilterQuery, InsertOneWriteOpResult, InsertWriteOpResult, ObjectId, ReplaceOneOptions, UpdateWriteOpResult} from 'mongodb';

import {assertNever} from '../utils/error';
import {Logger, tree} from '../utils/logger';

import {Commit, CommitDocument, InsertCommit, UpdateManyCommit, UpdateOneCommit} from './commit';
import {Database} from './database';
import {TpcColl, TpcDocument} from './tpc.model';

const log = new Logger(`APP_TPC_${process.pid}`);

export class Tpc {
  private _id = new ObjectId();
  private state: 'initial'|'pending'|'applied' = 'initial';
  private commits = new Set<Commit<unknown>>();
  private lastModified = new Date();

  constructor() {}

  static fromDoc({_id, state, commitDocs, lastModified}: TpcDocument): Tpc {
    const tpc = new this();
    tpc._id = _id;
    tpc.state = state;
    tpc.lastModified = lastModified;

    const commits = commitDocs.map(doc => {
      switch (doc.type) {
        case 'insert':
          return InsertCommit.fromDoc(doc);
        case 'updateOne':
          return UpdateOneCommit.fromDoc(doc);
        case 'updateMany':
          return UpdateManyCommit.fromDoc(doc);
        default:
          return assertNever(doc, 'Tpc fromDoc received unknown commit type');
      }
    });
    tpc.commits = new Set<Commit<unknown>>(commits);

    return tpc;
  }

  private toDoc(): TpcDocument {
    const doc: TpcDocument = {
      _id: this._id,
      state: this.state,
      commitDocs: [...this.commits].map(commit => commit.toDoc()),
      lastModified: this.lastModified
    };
    return doc;
  }

  commit<T>(commit: Commit<T>): this {
    this.commits.add(commit);
    return this;
  }

  insert<T>(
      collection: Collection<T>, doc: object,
      options?: CollectionInsertOneOptions): this;
  insert<T>(
      collection: Collection<T>, doc: object[],
      options?: CollectionInsertManyOptions): this;
  insert<T>(
      collection: Collection<T>, doc: object|object[],
      options?: CollectionInsertOneOptions|CollectionInsertManyOptions): this {
    const commit = new InsertCommit(collection, doc, options);
    this.commits.add(commit);
    return this;
  }

  updateOne<T>(
      collection: Collection<T>, filter: FilterQuery<T>, update: object,
      options?: ReplaceOneOptions) {
    const commit = new UpdateOneCommit(collection, filter, update, options);
    this.commits.add(commit);
    return this;
  }

  updateMany<T>(
      collection: Collection<T>, filter: FilterQuery<T>, update: object,
      options?: CommonOptions&{upsert?: boolean}) {
    const commit = new UpdateManyCommit(collection, filter, update, options);
    this.commits.add(commit);
    return this;
  }

  async run(): Promise<void> {
    this.validate();
    await this.runTpcInsert();
    await this.runToPending();
    await this.runToApplied();
    await this.runToDone();
  }

  static async recover(): Promise<void>;
  static async recover(tpcDocument: TpcDocument): Promise<void>;
  static async recover(tpcDocument?: TpcDocument): Promise<void> {
    if (tpcDocument) {
      const tpc = this.fromDoc(tpcDocument);
      return tpc.recover();
    } else {
      const cursor = TpcColl().find({});
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const tpc = this.fromDoc(doc!);
        await tpc.recover();
      }
      log.a('Tpc finished recovering documents');
    }
  }

  private async recover(): Promise<void> {
    switch (this.state) {
      case 'initial':
        await this.runToPending();
        await this.runToApplied();
        await this.runToDone();
        break;
      case 'pending':
        await this.runToApplied();
        await this.runToDone();
        break;
      case 'applied':
        await this.runToDone();
        break;
      default:
        assertNever(
            this.state, 'Tpc recover received document in unknown state');
        break;
    }
  }

  private validate(): void {
    if (this.commits.size === 0)
      throw new Error('Two phase commit should have atleast one commit');

    for (const commit of this.commits) switch (commit.type) {
        case 'insert':
          if (commit.doc instanceof Array && !commit.doc.length)
            throw new Error(
                'Two phase commit cannot have array doc of zero length');
          break;
        default:
          break;
      }
  }

  private async runTpcInsert(): Promise<void> {
    this.lastModified.setTime(Date.now());
    /* For updates Tpc document may have mongodb driver invalid keynames such as
    '$set'. Use db.command directly to bypass driver validation and insert
    document. Should work as long as invalid keynames for other purposes (e.g.
    retreival). bypassDocumentValidation flag is probably used for server side
    validation. As first link below points out, servers can accept keynames
    starting with '$' so false is fine. For more, see
    https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
    and https://jira.mongodb.org/browse/SERVER-30575 */
    const result = await Database.db.command({
      insert: TpcColl().collectionName,
      documents: [this.toDoc()],
      bypassDocumentValidation: false
    });
    assert(result.ok === 1);
  }

  private async runToPending(): Promise<void> {
    const result = await TpcColl().updateOne(
        {_id: this._id, state: 'initial'},
        {$set: {state: 'pending'}, $currentDate: {lastModified: true}});
    assert((result.matchedCount && result.modifiedCount) === 1);
  }

  private async runToApplied(): Promise<void> {
    Tpc.exclude();

    const results$: Array<Promise<{result: {ok: number, n?: number}}>> = [];
    for (const commit of this.commits) switch (commit.type) {
        case 'insert':
          results$.push(this.runInsertCommitToApplied(commit));
          break;
        case 'updateOne':
        case 'updateMany':
          results$.push(this.runUpdateCommitToApplied(commit));
          break;
        default:
          assertNever(commit, 'Tpc runToApplied received unknown commit type');
          break;
      }

    const results = await Promise.all(results$);
    results.forEach(r => assert(r.result.ok === 1));

    const res = await TpcColl().updateOne(
        {_id: this._id, state: 'pending'},
        {$set: {state: 'applied'}, $currentDate: {lastModified: true}});
    assert((res.matchedCount && res.modifiedCount) === 1);
  }

  private async runToDone(): Promise<void> {
    Tpc.exclude();

    const results$: Array<Promise<{result: {ok: number, n?: number}}>> = [];

    for (const commit of this.commits) switch (commit.type) {
        case 'insert':
          results$.push(this.runInsertCommitToDone(commit));
          break;
        case 'updateOne':
        case 'updateMany':
          results$.push(this.runUpdateCommitToDone(commit));
          break;
        default:
          assertNever(commit, 'Tpc runToDone received unknown commit type');
          break;
      }

    const results = await Promise.all(results$);
    results.forEach(r => assert(r.result.ok === 1));

    const res = await TpcColl().deleteOne({_id: this._id, state: 'applied'});
    assert(res.deletedCount === 1);
  }

  private async runInsertCommitToApplied(commit: InsertCommit<unknown>):
      Promise<{result: {ok: number, n?: number}}> {
    let options = commit.options ? {...commit.options} : undefined;
    options ? options.ordered = true : options = {ordered: true};

    let r$: Promise<{result: {ok: number, n?: number}}>;

    if (commit.doc instanceof Array) {
      const docs = commit.doc.map(d => ({...d, __tId__: this._id}));

      const saved =
          await commit.collection
              .find<{__id__: ObjectId}>(
                  {__id__: {$in: docs.map(d => d.__id__)}, __tId__: this._id})
              .project({__id__: 1})
              .toArray();
      const unsaved =
          docs.filter(d => saved.every(el => !el.__id__.equals(d.__id__)));
      if (unsaved.length === 0) return {result: {ok: 1}};

      r$ = commit.collection.insertMany(unsaved, options);
    } else {
      const doc = {...commit.doc, __tId__: this._id};
      if (await commit.collection.findOne(
              {__id__: doc.__id__, __tId__: this._id}))
        return {result: {ok: 1}};

      r$ = commit.collection.insertOne(doc, options);
    }
    return r$;
  }

  private async runUpdateCommitToApplied(commit: UpdateOneCommit<unknown>|
                                         UpdateManyCommit<unknown>):
      Promise<{result: {ok: number, n?: number}}> {
    const filter = {...commit.filter, __tId__: {$ne: this._id}};
    const update = {...commit.update};
    update.$set = {...commit.update.$set, __tId__: this._id};
    const options = commit.options ? {...commit.options} : undefined;

    let r$: Promise<{result: {ok: number, n?: number}}>;
    if (commit.type === 'updateMany')
      r$ = commit.collection.updateMany(filter, update, options);
    else
      r$ = commit.collection.updateOne(filter, update, options);
    return r$;
  }

  private async runInsertCommitToDone(commit: InsertCommit<unknown>):
      Promise<{result: {ok: number, n?: number}}> {
    const doc = commit.doc;

    let r$: Promise<{result: {ok: number, n?: number}}>;
    if (doc instanceof Array)
      r$ = commit.collection.updateMany(
          {__id__: {$in: doc.map(d => d.__id__)}, __tId__: this._id},
          {$unset: {__tId__: '', __id__: ''}});
    else
      r$ = commit.collection.updateOne(
          {__id__: doc.__id__, __tId__: this._id},
          {$unset: {__tId__: '', __id__: ''}});

    return r$;
  }

  private async runUpdateCommitToDone(commit: UpdateOneCommit<unknown>|
                                      UpdateManyCommit<unknown>):
      Promise<{result: {ok: number, n?: number}}> {
    const filter = {...commit.filter, __tId__: this._id};

    let r$: Promise<{result: {ok: number, n?: number}}>;
    if (commit.type === 'updateMany')
      r$ = commit.collection.updateMany(filter, {$unset: {__tId__: ''}});
    else
      r$ = commit.collection.updateOne(filter, {$unset: {__tId__: ''}});

    return r$;
  }

  private static exclude(): void {}
}
