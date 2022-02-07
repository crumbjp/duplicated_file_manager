'use strict';

var _ = require('lodash');
var mongoose = require('mongoose');

exports.database = "dfm";

let schemas = {};
exports.schemas = schemas;
const ObjectId = mongoose.Schema.Types.ObjectId;

schemas.file_hash = new mongoose.Schema({
  hash          : { type: String},
  path          : { type: String},
});
/*
 db.file_hashes.createIndex({hash: 1}, {uniq: 1});
 db.file_hashes.createIndex({path: 1}, {uniq: 1});
 */
