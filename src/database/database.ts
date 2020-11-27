import {Collection, Db, MongoClient, MongoClientOptions} from 'mongodb';
import {URL} from 'url';

import {Logger} from '../utils/logger';

import {Model} from './model';

const log = new Logger(`APP_DB_${process.pid}`);

export class Database {
  private static client: MongoClient;
  static db: Db;
  private static cachedModels = new Set<Model<unknown>>();

  static connect(url: URL, opts: MongoClientOptions): Promise<void> {
    return MongoClient.connect(url.toString(), opts)
        .then(client => {
          log.a(`MongoClient connected to ${url.host}${url.pathname}`);

          this.client = client;
          this.db = client.db();
        })
        .then(() => this.initModels())
        .catch(err => {
          log.e('MongoClient initial connection error: \n%O', err);
          throw err;
        });
  }

  private static initModels(): Promise<void> {
    const models$ = [];
    for (const model of this.cachedModels) {
      const promise = new Promise<Collection<unknown>>((resolve, reject) => {
        Database.db.collection<unknown>(model.name, (err, coll) => {
          if (err) reject(err);
          resolve(coll);
        });
      });
      const model$ = promise.then(coll => model.init(coll));
      models$.push(model$);
    }

    return Promise.all(models$).then(_ => {
      log.a('Mongo collections initialized');
    });
  }

  static disconnect(force?: boolean): Promise<void> {
    return this.client.close(force)
        .then(() => log.a('MongoClient connection closed'))
        .catch((err: never) => {
          log.e('Error closing MongoClient connection:\n%O', err);
          throw err;
        });
  }

  static drop(): Promise<void> {
    return this.db.dropDatabase()
        .then(() => log.a(`MongoDB dropped database: ${this.db.databaseName}`))
        .catch(err => {
          log.e('Error dropping MongoDB database: %O', err);
          throw err;
        });
  }

  static model<Schema>(name: string): Model<Schema> {
    for (const model of this.cachedModels)
      if (model.name === name) return model as Model<Schema>;

    const inst = new Model<Schema>(name);
    this.cachedModels.add(inst);
    return inst;
  }
}
