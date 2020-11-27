import {Collection, CollectionInsertManyOptions, CollectionInsertOneOptions, CommonOptions, FilterQuery, ObjectId, ReplaceOneOptions} from 'mongodb';
import {Database} from './database';

export type Commit<T> = InsertCommit<T>|UpdateOneCommit<T>|UpdateManyCommit<T>;
export type CommitDocument<T> =
    InsertCommitDocument|UpdateOneCommitDocument<T>|UpdateManyCommitDocument<T>;

class BaseCommit<T> {
  readonly collection: Collection<T>;
  constructor(collection: Collection<T>) {
    this.collection = collection;
  }
}

export class InsertCommit<T> extends BaseCommit<T> {
  readonly type: 'insert' = 'insert';
  readonly doc: DocWithId|DocWithId[];
  readonly options?: CollectionInsertOneOptions|CollectionInsertManyOptions;

  constructor(
      collection: Collection<T>, doc: object|DocWithId,
      options?: CollectionInsertOneOptions);
  constructor(
      collection: Collection<T>, doc: object[]|DocWithId,
      options?: CollectionInsertManyOptions);
  constructor(
      collection: Collection<T>, doc: object|DocWithId|object[]|DocWithId[],
      options?: CollectionInsertOneOptions|CollectionInsertManyOptions) {
    super(collection);

    if (doc instanceof Array)
      // see https://github.com/Microsoft/TypeScript/issues/7294
      this.doc =
          (doc as Array<(object | DocWithId)>).map(d => this.ensureId(d));
    else
      this.doc = this.ensureId(doc);

    if (options) this.options = options;
    Object.freeze(this);
  }

  static fromDoc({type, collectionName, doc, options}: InsertCommitDocument):
      InsertCommit<unknown> {
    const collection = Database.model<unknown>(collectionName).collection();
    return new this(collection, doc, options);
  }

  private ensureId(doc: object|DocWithId): DocWithId {
    if (!doc.hasOwnProperty('__id__'))
      return {...doc, __id__: new ObjectId()};
    else
      return doc as DocWithId;
  }

  toDoc(): InsertCommitDocument {
    const commitDoc: InsertCommitDocument = {
      type: this.type,
      doc: this.doc,
      collectionName: this.collection.collectionName
    };
    // TODO: convert options to document and list limitations
    if (this.options) commitDoc.options = this.options;
    return commitDoc;
  }
}

export class UpdateOneCommit<T> extends BaseCommit<T> {
  readonly type: 'updateOne' = 'updateOne';
  readonly filter: FilterQuery<T>;
  readonly update: {$set?: object, [key: string]: any};
  readonly options?: ReplaceOneOptions;

  constructor(
      collection: Collection<T>, filter: FilterQuery<T>, update: object,
      options?: ReplaceOneOptions) {
    super(collection);
    this.filter = filter;
    this.update = update;
    if (options) this.options = options;
    Object.freeze(this);
  }

  static fromDoc({collectionName, filter, update, options}:
                     UpdateOneCommitDocument<unknown>):
      UpdateOneCommit<unknown> {
    const collection = Database.model<unknown>(collectionName).collection();
    return new this(collection, filter, update, options);
  }

  toDoc(): UpdateOneCommitDocument<T> {
    const doc: UpdateOneCommitDocument<T> = {
      type: this.type,
      filter: this.filter,
      update: this.update,
      collectionName: this.collection.collectionName
    };
    // TODO: convert options to document and list limitations
    if (this.options) doc.options = this.options;
    return doc;
  }
}

export class UpdateManyCommit<T> extends BaseCommit<T> {
  readonly type: 'updateMany' = 'updateMany';
  readonly filter: FilterQuery<T>;
  readonly update: {$set?: object, [key: string]: any};
  readonly options?: CommonOptions&{upsert?: boolean};

  constructor(
      collection: Collection<T>, filter: FilterQuery<T>, update: object,
      options?: CommonOptions&{upsert?: boolean}) {
    super(collection);
    this.filter = filter;
    this.update = update;
    if (options) this.options = options;
    Object.freeze(this);
  }

  static fromDoc({collectionName, filter, update, options}:
                     UpdateManyCommitDocument<unknown>):
      UpdateManyCommit<unknown> {
    const collection = Database.model<unknown>(collectionName).collection();
    return new this(collection, filter, update, options);
  }

  toDoc(): UpdateManyCommitDocument<T> {
    const doc: UpdateManyCommitDocument<T> = {
      type: this.type,
      filter: this.filter,
      update: this.update,
      collectionName: this.collection.collectionName
    };
    // TODO: convert options to document and list limitations
    if (this.options) doc.options = this.options;
    return doc;
  }
}

interface InsertCommitDocument {
  type: 'insert';
  doc: DocWithId|DocWithId[];
  collectionName: string;
  options?: CollectionInsertOneOptions|CollectionInsertManyOptions;
}

interface UpdateOneCommitDocument<T> {
  type: 'updateOne';
  collectionName: string;
  filter: FilterQuery<T>;
  update: {$set?: object, [key: string]: any};
  options?: ReplaceOneOptions;
}

interface UpdateManyCommitDocument<T> {
  type: 'updateMany';
  collectionName: string;
  filter: FilterQuery<T>;
  update: {$set?: object, [key: string]: any};
  options?: CommonOptions&{upsert?: boolean};
}

type objectAlias = object;
interface DocWithId extends objectAlias {
  __id__: ObjectId;
}
