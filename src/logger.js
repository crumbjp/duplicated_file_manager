'use strict';

const _ = require('lodash');
const fs = require('fs');
const util = require('util');
const config = require('config');
const moment = require('moment');
require('moment-duration-format')(moment);

let staticFd = null;
let staticNoConsole = false;
let staticFileName = null;

function now() {
  function pad(i, n) {
    if (!n) {
      n = 2;
    }
    return ('000' + i).slice(-1 * n);
  }
  let n = new Date();
  return `${n.getYear()+1900}-${pad(n.getMonth()+1)}-${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}.${pad(n.getMilliseconds(), 3)}`;
}

class Logger {
  static get LV() {
    return {
      fatal: 1,
      error: 10,
      warning: 20,
      info: 30,
      verbose: 40,
      trace: 50,
      debug: 1000
    };
  }

  constructor() {
    this.prefix = '';
    this.perChecker = {};
  }

  perCheckStart(key, ctx = this.perChecker) {
    ctx[key] = ctx[key] || {
      count: 0,
      spent: 0
    };
    if (ctx[key].start) {
      this.log('error', [`performance check: ${key} need end first.`]);
    }
    ctx[key].start = moment();
  }

  perCheckElapsed(key, ctx = this.perChecker) {
    if (!ctx[key] || !ctx[key].start) {
      this.log('error', [`performance check: ${key} need start first.`]);
      return null;
    }
    return moment() - ctx[key].start;
  }

  perCheckEnd(key, term = 100, ctx = this.perChecker) {
    this.perChecker[key] = this.perChecker[key] || {
      count: 0,
      spent: 0
    };
    this.perChecker[key].spent += this.perCheckElapsed(key, ctx);
    this.perChecker[key].count += 1;
    ctx[key].start = null;
    if (this.perChecker[key].count > 0 && this.perChecker[key].count % term == 0) {
      this.perCheckOutput(key);
    }
  }

  perCheckOutput(key) {
    if (key && this.perChecker[key]) {
      this.log('debug', [`========================================`]);
      let spent = moment.duration(this.perChecker[key].spent, 'milliseconds').format('d [days] h [hours] m [minutes] s [seconds]');
      this.log('debug', [`performance check: ${key} count: ${this.perChecker[key].count} spent: ${spent}`]);
    } else {
      for(let key in this.perChecker) {
        this.perCheckOutput(key);
      }
    }
  }

  perClear() {
    this.perChecker = {};
  }

  loglv(lv) {
    Logger.loglv = Logger.LV[lv];
  }

  setNoConsole(noConsole) {
    staticNoConsole = noConsole;
  }

  setFile(filename, noConsole = false) {
    this.fd = fs.openSync(filename, 'a+', 0o644);
    staticNoConsole = noConsole;
  }

  setStaticFile(filename, noConsole = false) {
    staticFileName = filename;
    staticFd = fs.openSync(filename, 'a+', 0o644);
    staticNoConsole = noConsole;
  }

  getStaticFileName() {
    return staticFileName;
  }

  setPrefix(prefix) {
    this.prefix = prefix;
  }

  log(loglv, args) {
    let line = `${now()} [${loglv}] ${this.prefix}`;
    for(let arg of args) {
      if(_.isString(arg)) {
        line += arg;
      } else {
        line += util.inspect(arg, {maxStringLength: null});
      }
      line += ' ';
    }
    if(!staticNoConsole){
      console.log(line);
    }
    if (this.fd) {
      fs.writeSync(this.fd, line + '\n');
    } else if(staticFd) {
      fs.writeSync(staticFd, line + '\n');
    }
  }
};
Logger.loglv = eval(`Logger.LV.${config.loglv}`);

function defineLv(lvName, lv) {
  Object.defineProperty(Logger.prototype, lvName, {
    value: function() {
      if ( Logger.loglv >= lv ) {
        this.log(lvName, arguments);
      }
    }
  });
}

for(let lvName in Logger.LV) {
  defineLv(lvName, Logger.LV[lvName]);
}

module.exports = () => {
  return new Logger();
};
