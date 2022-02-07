'use strict';

const config = require('config');
const mongoose = require('mongoose');
const logger = require('logger')();

module.exports = (database, done) => {
  let setting = config.mongodb[database];
  let opts = {
    useNewUrlParser: true,
    socketTimeoutMS: 10800000,
    connectTimeoutMS: 10800000,
    keepAlive: 10800000,
    useFindAndModify: false,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  };

  let auth = '';
  if (setting.user && setting.password) {
    auth = `${setting.user}:${setting.password}@`;
  }

  let uri = '';
  if (setting.replset && setting.replset.length > 0) {
    let servers = [];
    for (let server of setting.replset) {
      servers.push(`${server.host}:${server.port}`);
    }
    uri = `mongodb://${auth}${servers.join(',')}/${setting.database}`;
    opts.replicaSet = setting.setName;
    opts.readPreference = 'secondaryPreferred';
  } else {
    uri = `mongodb://${auth}${setting.host}:${setting.port}/${setting.database}`;
  }
  let connection = mongoose.createConnection(uri, opts);
  connection.on('open', () => {
    logger.info(`mongodb open connection ${database}`);
    if ( done ) {
      done();
    }
  });
  return connection;
};
