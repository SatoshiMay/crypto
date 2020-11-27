// tslint:disable-next-line:variable-name
const MongodbMemoryServer = require('mongodb-memory-server');

const mongod = new MongodbMemoryServer.default(
    {instance: {dbName: 'test_trinity'}, binary: {version: '3.4.10'}});

module.exports = async function setup() {
  // Set reference to mongod in order to close the server during teardown.
  // @ts-ignore
  global.__MONGOD__ = mongod;
  // Set reference to url to use as prefix for individual test-suites
  process.env.MONGO_URL_PREFIX = await mongod.getConnectionString();
  // process.env.MONGO_URL_PREFIX = 'mongodb://localhost:27017/test_trinity';
};
