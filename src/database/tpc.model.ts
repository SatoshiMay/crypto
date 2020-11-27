import {ObjectId} from 'bson';
import {CommitDocument} from './commit';
import {Database} from './database';

export interface TpcDocument {
  _id: ObjectId;
  state: 'initial'|'pending'|'applied';
  commitDocs: Array<CommitDocument<unknown>>;
  lastModified: Date;
}

/* tslint:disable:variable-name */
export const TpcColl = Database.model<TpcDocument>('tpcs').collection;
