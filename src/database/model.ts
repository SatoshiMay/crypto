import {Collection, IndexOptions} from 'mongodb';

import {Logger} from '../utils/logger';

const log = new Logger(`APP_MODEL_${process.pid}`);

export class Model<Schema> {
  readonly name: string;
  private _collection: Collection<Schema>;
  private indices = new Map<string|any, IndexOptions|undefined>();

  get collection(): () => Collection<Schema> {
    return () => this._collection;
  }

  constructor(name: string) {
    this.name = name;
    this._collection = {} as Collection<Schema>;
  }

  init(coll: Collection<Schema>): Promise<void> {
    this._collection = coll;
    Object.freeze(this._collection);

    return this.createIndices();  // TODO: create in the background
  }

  private createIndices(): Promise<void> {
    const indices$ = [];
    for (const [fieldorSpec, options] of this.indices) {
      const index$ = this._collection.createIndex(fieldorSpec, options);
      indices$.push(index$);
    }

    return Promise.all(indices$).then(_ => this.indices.clear()).catch(err => {
      log.e('Error initializing MongoDB indices: \n%O', err);
      throw err;
    });
  }

  addIndex(fieldOrSpec: string|any, options?: IndexOptions): void {
    this.indices.set(fieldOrSpec, options);
  }
}
