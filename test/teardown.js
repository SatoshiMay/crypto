module.exports = async function teardown() {
  // @ts-ignore
  await global.__MONGOD__.stop();
};
