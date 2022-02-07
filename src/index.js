'use strict';

const opts   = require('opts');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const moment = require('moment');
const hasha = require('hasha');
const models = require('models');
const FileHash = models.dfm.FileHash;

let options = [{
  short       : 'd',
  long        : 'directory',
  description : 'directory',
  value       : true,
  required    : true
}];
opts.parse(options);
let directory = opts.get('directory');

let dotLogFile = fs.openSync('./log/dot.log', 'w');
const dotLog = (line) => {
  fs.writeSync(dotLogFile, line + "\n");
};

let scriptFile = fs.openSync('./log/script.sh', 'w');
const scriptLog = (line) => {
  fs.writeSync(scriptFile, line + "\n");
};
scriptLog('!/usr/bin/env bash');
scriptLog('set -e');

const manageFiles = (files) => {
  return new Promise(async (resolve, reject) => {
    try {
      let hashes = _.chain(files)
          .map((file) => file.hash)
          .compact()
          .uniq()
          .value();
      let paths = _.chain(files)
          .map((file) => file.path)
          .compact()
          .uniq()
          .value();
      let fileHashes = await FileHash.find({
        $or: [{
          hash: {
            $in: hashes
          },
        }, {
          path: {
            $in: paths
          },
        }]
      }).select({
        hash: 1,
        path: 1,
      });
      let fileHashByHash = _.keyBy(fileHashes, 'hash');
      let fileHashByPath = _.keyBy(fileHashes, 'path');
      let changes = [];
      for(let file of files) {
        let byHash = fileHashByHash[file.hash];
        let byPath = fileHashByPath[file.path];
        if(!byHash && !byPath) {
          // New
          changes.push({
            op: 'insert',
            obj: file,
          });
        } else if(byHash == byPath) {
          //   // Already
          //   // Do nothing
console.log('Already', file.path)
        } else {
          if(byHash && byHash.path != file.path) {
            // Duplicated
            console.log(`Duplicated ${byHash.path} => ${file.path}`);
            scriptLog(`rm ${file.path}`);
          }
          if(byPath && byPath.hash != file.hash) {
            // Replaced
console.log(`Replaced $${file.path}`);
            changes.push({
              op: 'update',
              find: {
                _id: byPath._id
              },
              obj: {
                $set: {
                  hash: file.hash
                }
              }
            });
          }
        }
      }
      resolve(changes);
    } catch(e) {
      reject(e);
    }
  });
};


const walkDirectory = (directory) => {
  return new Promise(async (resolve, reject) => {
    try {
      directory = path.resolve(directory);
      console.log(` - ${directory}`);
      let dirents = fs.readdirSync(directory, {
        withFileTypes: true
      });
      let files = [];
      let directories = [];
      for(let dirent of dirents) {
        let fullPath = directory + '/' + dirent.name;
        if(dirent.name.startsWith('.')) {
          dotLog(fullPath);
        } else if(dirent.isDirectory()) {
          directories.push(fullPath);
        } else if(dirent.isFile()) {
          let hash = hasha.fromFileSync(fullPath);
          files.push({
            path: fullPath,
            hash: hash,
          });
        } else {
          console.log('****', fullPath)
        }
      }
      let changes = await manageFiles(files);
      let BULK_SIZE = 100;
      for(let partialChanges of _.chunk(changes, BULK_SIZE)) {
        let bulk = FileHash.collection.initializeUnorderedBulkOp({w: 1, j:1, wtimeout: 3600000});
        if(!bulk) {
          throw 'Fail to create initializeUnorderedBulkOp';
        }
        for(let change of partialChanges) {
          if(change.op == 'insert') {
            bulk.insert(change.obj);
          } else if(change.op == 'update') {
            bulk.find(change.find).updateOne(change.obj);
          }
        }
        let bulkResults = await bulk.execute({w: 1, wtimeout: 3600000});
        let bulkErrors = _.chain(bulkResults).map((bulkResult) => bulkResult.writeErrors).flatten();
        if(bulkErrors.length > 0) {
          console.log(bulkErrors);
        }
      }
      for(let fullPath of directories) {
        await walkDirectory(fullPath);
      }
      resolve();
    } catch(e) {
      reject(e);
    }
  });
};

(async () => {
  console.log(`=== Start ${directory}`);
  await walkDirectory(directory);
  console.log(`=== End ${directory}`);
  fs.closeSync(dotLogFile);
  fs.closeSync(scriptFile);
  process.exit(1);
})();
