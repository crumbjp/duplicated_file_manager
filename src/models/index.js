'use strict';

var fs = require('fs');
var pluralize = require('pluralize'); // Dont update to 8.0.0
var _ = require('lodash');
var async = require('async');
var logger = require("logger");
var connector = require('./connector');
var mongoose = require('mongoose');
var models = {
  ObjectId: mongoose.Types.ObjectId
};

module.exports = models;

models.ModelObjectClass = (model) => {
  class ObjectClass {
    constructor(object) {
      if(object) {
        for(var field in object) {
          if(field == '_id') {
            this._id = models.ObjectId(object[field]);
            this.id = String(this._id);
          } else if(model.schema.obj[field]) {
            if(object[field] === undefined && model.schema.obj[field].type != Array) {
            } else if(object[field] === null) {
              this[field] = null;
            } else if(object[field] === '' && model.schema.obj[field].type != Boolean) {
              this[field] = null;
            } else if(model.schema.obj[field].type == String) {
              this[field] = String(object[field]);
            } else if(model.schema.obj[field].type == Number) {
              this[field] = Number(object[field]);
            } else if(model.schema.obj[field].type == Boolean) {
              if(object[field] == 'false') {
                this[field] = false;
              } else if(object[field] == 'null') {
              } else if(object[field] == 'undefined') {
              } else {
                this[field] = !!object[field];
              }
            } else if(model.schema.obj[field].type == Date) {
              this[field] = new Date(object[field]);
            } else if(model.schema.obj[field].type == Array) {
              if(_.isArray(object[field])) {
                this[field] = object[field];
              } else {
                this[field] = [object[field]];
              }
            } else {
              this[field] = object[field];
            }
          }
        }
      }
      this._id = this._id || models.ObjectId();
    }
    toObject() {
      var object = {};
      object._id = this._id;
      for(var field in model.schema.obj) {
        if(this[field] !== undefined) {
          object[field] = this[field];
        }
      }
      return object;
    }
  };
  return ObjectClass;
};

var capitalCase = (str) => {
  return str.split('_').map((w) => {
    return _.capitalize(w);
  }).join('');
};
models.capitalCase = capitalCase;

var fix_pluralize = (str) => {
  return pluralize(str);
};

var defineModel = (mongooseConnection, database, name, schema) => {
  models[database] = models[database] || {};
  var capitalName = capitalCase(name);
  Object.defineProperty(models[database], capitalName, {
    configurable: true,
    get: () => {
      var model = mongooseConnection.model(fix_pluralize(name), schema, fix_pluralize(name));
      try {
        model = require(`./${database}/${name}`)(model, capitalName);
      } catch(e) {
      }
      Object.defineProperty(models[database], capitalName, {
        value: model
      });
      return model;
    }
  });
};

var mongooseConnections = [];

var files = fs.readdirSync(`${__dirname}/dbs`);
for (var file of files) {
  if (file.match(/\.js$/)) {
    file = file.replace(/\.js$/, '');
    var db = require(`./dbs/${file}`);
    var mongooseConnection = connector(db.database);
    mongooseConnections.push(mongooseConnection);
    for (var name in db.schemas) {
      var schema = db.schemas[name];
      defineModel(mongooseConnection, db.database, name, schema);
    }
  }
}

models.terminate = () => {
  async.eachSeries(mongooseConnections, (mongooseConnection, done) => {
    mongooseConnection.close();
    done(null);
  });
};

models.resultCallback = (done) => {
  (err, result) => {
    if(err){
      logger.error('MongoError', err);
      if (err.name == 'MongoError' && err.message == 'no mongos proxy available'){
        logger.error('Suicide by MongoError', err);
        process.exit(1);
      }
    }
    done(err, result);
  };
};
