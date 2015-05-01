'use strict';

/**
 * Dependencies
 */

var Messenger = require('./messenger');
var emitter = require('./emitter');
var utils = require('./utils');

/**
 * Exports
 */

module.exports = ChildThread;

/**
 * Mini debugger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[ChildThread]') : function() {};

/**
 * Error messages
 *
 * @type {Object}
 */

const ERRORS = {
  1: 'iframes can\'t be spawned from workers',
  2: 'requst to get service timed out'
};

/**
 * Extends `Emitter`
 */

ChildThread.prototype = Object.create(emitter.prototype);

/**
 * Wraps a reference to a 'thread'.
 *
 * Providing a means to send/recieve
 * messages to/from a 'thread'.
 *
 * Params:
 *
 *   - `src` {String}
 *   - `type` {String} ['window','worker','sharedworker']
 *   - `parentNode` {HTMLElement}
 *
 * @param {[type]} params [description]
 */

function ChildThread(params) {
  if (!(this instanceof ChildThread)) return new ChildThread(params);
  this.id = utils.uuid();
  this.src = params.src;
  this.type = params.type;
  this.parentNode = params.parentNode;

  // When the thread is 'ready'
  // it will pass out this data
  this.services = {};
  this.threadId = undefined;

  this.messenger = new Messenger(this.id, '[ChildThread]')
    .handle('redundant', this.onredundant, this)
    .handle('serviceready', this.onserviceready, this);

  this.onmessage = this.onmessage.bind(this);

  this.target = params.target ||  this.createTarget();

  this.listen();
  this.ready = this.checkReady();

  debug('initialized', this.type);
}

ChildThread.prototype.createTarget = function() {
  debug('create process');
  var id = utils.uuid();
  switch(this.type) {
    case 'worker':
      return new Worker(this.src + '?pid=' + id);
    case 'sharedworker':
      return new SharedWorker(this.src + '?pid=' + id);
    case 'window':
      if (utils.env() !== 'window') throw new Error(ERRORS[1]);
      var iframe = document.createElement('iframe');
      (this.parentNode || document.body).appendChild(iframe);
      iframe.name = id;
      iframe.src = this.src;
      return iframe;
  }
};

ChildThread.prototype.getService = function(name) {
  return this.ready.then(function() {
    return this._getService(name);
  }.bind(this));
};

ChildThread.prototype._getService = function(name) {
  debug('get service', name);
  var service = this.services[name];

  if (service) {
    debug('service already known');
    return Promise.resolve(service);
  }

  var deferred = utils.deferred();
  var self = this;

  this.on('serviceready', onServiceReady);

  function onServiceReady(service) {
    if (service.name !== name) return;
    debug('service ready', service.name);
    self.off('serviceready', onServiceReady);
    clearTimeout(timeout);
    deferred.resolve(service);
  }

  // Request will timeout when no service of
  // this name becomes ready within 4sec
  var timeout = setTimeout(function() {
    self.off('serviceready', onServiceReady);
    deferred.reject(new Error(ERRORS[2]));
  }, 4000);

  return deferred.promise;
};

ChildThread.prototype.checkReady = function() {
  debug('check ready');
  var deferred = utils.deferred();
  var called = 0;
  var self = this;

  this.messenger.handle('threadready', ready);
  this.messenger.request(this, { type: 'ping' }).then(ready);

  function ready(thread) {
    if (called++) return;
    debug('thread ready', thread);
    self.messenger.unhandle('threadready');
    self.threadId = thread.id;
    self.services = thread.services;
    deferred.resolve();
  }

  return deferred.promise;
};

ChildThread.prototype.postMessage = function(message) {
  debug('post message', message);
  switch(this.type) {
    case 'worker': this.target.postMessage(message); break;
    case 'sharedworker': this.target.port.postMessage(message); break;
    case 'window':
      if (!this.target.contentWindow) return;
      this.target.contentWindow.postMessage(message, '*');
      break;
  }
};

ChildThread.prototype.listen = function() {
  debug('listen (%s)', this.type);
  switch(this.type) {
    case 'worker':
      this.target.addEventListener('message', this.onmessage);
      break;
    case 'sharedworker':
      this.target.port.start();
      this.target.port.addEventListener('message', this.onmessage);
      break;
    case 'window':
      addEventListener('message', this.onmessage);
  }
};

ChildThread.prototype.onmessage = function(e) {
  debug('on message', e.data.type);
  this.messenger.parse(e);

  // We must re-emit the message so that
  // clients can listen directly for
  // messages on Threads.
  this.emit('message', e);
};

ChildThread.prototype.unlisten = function() {
  switch(this.type) {
    case 'worker':
      this.target.removeEventListener('message', this.messenger.parse);
      break;
    case 'sharedworker':
      this.target.port.close();
      this.target.port.removeEventListener('message', this.messenger.parse);
      break;
    case 'window':
      removeEventListener('message', this.messenger.parse);
  }
};

ChildThread.prototype.onserviceready = function(service) {
  debug('on service ready', service);
  this.services[service.name] = service;
  this.emit('serviceready', service);
};

ChildThread.prototype.onredundant = function() {
  debug('redundant');
  this.emit('redundant');
};

ChildThread.prototype.destroy = function() {
  this.unlisten();
  this.destroyProcess();
};

ChildThread.prototype.destroyProcess = function() {
  debug('destroy thread (%s)');
  switch(this.type) {
    case 'worker': this.target.terminate(); break;
    case 'sharedworker': this.target.port.close(); break;
    case 'window': this.target.remove(); break;
  }
};
