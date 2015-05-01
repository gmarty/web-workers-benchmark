(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.threads = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

module.exports = {
  create: require('./lib/child-thread'),
  manager: require('./lib/manager'),
  service: require('./lib/service'),
  client: require('./lib/client')
};

},{"./lib/child-thread":2,"./lib/client":3,"./lib/manager":6,"./lib/service":8}],2:[function(require,module,exports){
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

},{"./emitter":5,"./messenger":7,"./utils":11}],3:[function(require,module,exports){
'use strict';

/**
 * Dependencies
 */

var thread = require('../thread-global');
var ClientStream = require('./stream');
var Messenger = require('../messenger');
var Emitter = require('../emitter');
var utils = require('../utils');

/**
 * Exports
 */

module.exports = Client;

/**
 * Global 'manager' channel
 *
 * @type {BroadcastChannel}
 */

var manager = new BroadcastChannel('threadsmanager');

/**
 * Simple logger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[client]') : function() {};

/**
 * Extends `Emitter`
 */

Client.prototype = Object.create(Emitter.prototype);

/**
 * Initialize a new `Client`.
 *
 * @param {String} service The service name
 * @param {Object} options
 * @param {ChildThread} options.thread
 * @param {Object} options.contract
 */

function Client(service, options) {
  if (!(this instanceof Client)) return new Client(service, options);
  this.contract = options && options.contract;
  this.thread = options && options.thread;
  this.id = utils.uuid();

  this.requestQueue = [];
  this.requests = {};
  this._activeStreams = {};

  this.connecting = false;
  this.connected = false;

  this.service = {
    channel: undefined,
    name: service,
    id: undefined
  };

  this.messenger = new Messenger(this.id, 'client')
    .handle('streamevent', this.onstreamevent, this)
    .handle('broadcast', this.onbroadcast, this);

  // If this client is directly linked to a thread
  // then listen for messages directly from that thread
  if (this.thread) this.thread.on('message', this.messenger.parse);

  // TODO: We may be able to add/remove this just for
  // connectViaManager phase.
  manager.addEventListener('message', this.messenger.parse);

  this.connect();
  debug('initialized', service);

}

/**
 * Attempt to connect the `Client`
 * with its service.
 *
 * @return {Promise}
 * @public
 */

Client.prototype.connect = function() {
  if (this.connected) return Promise.resolve();
  if (this.connecting) return this.connecting;
  debug('connect');
  var self = this;

  // Create a pipe ready for the
  // service to send messages down
  this.service.channel = new BroadcastChannel(this.id);
  this.service.channel.onmessage = this.messenger.parse;

  // If the client has a handle on the
  // thread we can connect to it directly,
  // else we go through the manager proxy.
  this.connecting = this.thread
    ? this.connectViaThread()
    : this.connectViaManager();

  return this.connecting.then(function(service) {
    debug('connected', service);
    self.connected = true;
    self.connecting = false;
    self.service.id = service.id;
    self.flushRequestQueue();
    thread.connection('outbound');
  });
};

/**
 * Attempt to connect directly with a
 * `Service` that lives inside a thread.
 *
 * @return {Promise}
 */

Client.prototype.connectViaThread = function() {
  debug('connect via thread');
  var self = this;
  return this.thread.getService(self.service.name)
    .then(function(service) {
      debug('got service', service);
      return self.messenger.request(self.thread, {
        type: 'connect',
        recipient: service.id,
        data: {
          client: self.id,
          service: service.name,
          contract: self.contract
        }
      });
    });
};

/**
 * Broadcasts a 'connect' message on the
 * manager channel to indicate that a
 * client wants to connect with a
 * particular service.
 *
 * This message will either be handled
 * by a manager that handles this service
 * name, or a prexisting service of this name.
 *
 * NOTE: Potentially if the is more than
 * one service of the same name running
 * the client could end up connecting
 * to the wrong service.
 *
 * Right now this produces quite a lot of noise
 * as every Service and every Manager will
 * respond to to messages on the 'threadsmanager'
 * channel.
 *
 * @private
 */

Client.prototype.connectViaManager = function() {
  debug('connect via manager');
  return this.messenger.request(manager, {
    type: 'connect',
    recipient: '*',
    data: {
      service: this.service.name,
      client: this.id
    },
  });
};

/**
 * Disconnect with the `Service`.
 *
 * This is a required if the `Manager`
 * is to destroy threads. If a thread
 * has `Services` that have connected
 * `Client`s then it is 'in-use'.
 *
 * @return {Promise}
 */

Client.prototype.disconnect = function() {
  debug('disconnect');
  return this.messenger.request(this.service.channel, {
    type: 'disconnect',
    recipient: this.service.id,
    data: this.id
  }).then(function() {

    // Ping the service one last time to let it
    // know that we've disconnected client-side
    this.messenger.push(this.service.channel, {
      type: 'disconnected',
      recipient: this.service.id,
      data: this.id
    });

    this.service.channel.close();
    delete this.service.channel;
    delete this.service.id;
    this.connected = false;
    thread.disconnection('outbound');
    debug('disconnected');
  }.bind(this));
};

/**
 * Make an outbound request to the `Service`.
 *
 * When the `Client` is not yet connected,
 * the request is added to a queue that
 * is flushed once a connection is made.
 *
 * @param  {String} type
 * @param  {Object} data
 * @return {Promise}
 */

Client.prototype.request = function(type, data) {
  debug('request', type, data);

  // Request queued
  if (!this.connected) {
    debug('request queued');
    var deferred = utils.deferred();
    this.requestQueue.push({
      deferred: deferred,
      arguments: arguments
    });

    return deferred.promise;
  }

  // Request made
  return this.messenger.request(this.service.channel, {
    type: type,
    recipient: this.service.id,
    data: data
  });
};

/**
 * Triggered when a `Service` broadcasts
 * an event to all connected `Client`s.
 *
 * The event is emitted on the `Client`s
 * internal `Emitter` so users can
 * listen via `client.on('foo', ...)`
 *
 * @param  {Object} broadcast
 */

Client.prototype.onbroadcast = function(broadcast) {
  debug('on broadcast', broadcast);
  this.emit(broadcast.type, broadcast.data);
};

/**
 * Call a method on the service.
 *
 * Promise will be resolved when service
 * responds with the data or rejected
 * when service throws an error or
 * returns a rejected promise.
 *
 * @param {String} method Name of the method to be called
 * @param {*} [...rest] data to be passed to to the method
 * @returns {Promise}
 * @public
 */

Client.prototype.method = function(method) {
  var args = [].slice.call(arguments, 1);
  debug('method', method, args);
  return this.request('method', {
    name: method,
    args: args
  });
};

/**
 * Call an action on the service.
 *
 * Used mainly for cases where service
 * needs to send data in chunks and/or
 * when you need to `cancel` the
 * action before it's complete.
 *
 * @param {String} method Name of the method to be called
 * @param {*} [...rest] data to be passed to to the method
 * @returns {ClientStream}
 * @public
 */

Client.prototype.stream = function(method) {
  var args = [].slice.call(arguments, 1);
  debug('stream', method, args);

  // Use an unique id to identify the
  // stream. We pass this value to the
  // service as well so we can map the
  // service and client streams.
  // They are different instances
  // that are 'connected' through
  // the bridge by this id.
  var id = utils.uuid();
  var stream = new ClientStream({
    id: id,
    client: this
  });

  this._activeStreams[id] = stream;
  this.request('stream', {
    name: method,
    args: args,
    id: id
  }).catch(function(err) {
    this.onstreamevent({
      type: 'abort',
      id: id,
      data: err
    });
  }.bind(this));

  return stream;
};

/**
 * Called every time the service calls
 * write/abort/close on the ServiceStream
 *
 * @param {Object} broadcast
 * @param {String} broadcast.id Stream ID
 * @param {String} broadcast.type Event type ('write', 'abort' or 'close')
 * @private
 */

Client.prototype.onstreamevent = function(broadcast) {
  var id = broadcast.id;
  var type = broadcast.type;
  var stream = this._activeStreams[id];

  stream._[type](broadcast.data);
  if (type === 'abort' || type === 'close') {
    delete this._activeStreams[id];
  }
};

/**
 * Reruns any requests that were queued
 * up before the `Client` established
 * a connection with the `Service`.
 *
 * @private
 */

Client.prototype.flushRequestQueue = function() {
  debug('flush waiting calls', this.requestQueue);
  var request;
  while ((request = this.requestQueue.shift())) {
    var resolve = request.deferred.resolve;
    resolve(this.request.apply(this, request.arguments));
  }
};

},{"../emitter":5,"../messenger":7,"../thread-global":10,"../utils":11,"./stream":4}],4:[function(require,module,exports){
'use strict';

/**
 * Dependencies
 */

var Emitter = require('../emitter');
var utils = require('../utils');

/**
 * Exports
 */

module.exports = ClientStream;

/**
 * Mini Logger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[ClientStream]') : function() {};

/**
 * Readable stream instance returned by
 * a `client.stream('methodName')` call.
 *
 * @param {Object} options
 * @param {String} options.id Stream Id, used to match client/service streams
 * @param {Client} options.client Client instance
 */

function ClientStream(options) {
  this._ = new ClientStreamPrivate(options);
}

/**
 * Promise that will be "resolved" when
 * stream is closed with success, and
 * "rejected" when service aborts
 * the action (abort == error).
 *
 * @type Promise
 */

Object.defineProperty(ClientStream.prototype, 'closed', {
  get: function() { return this._.closed.promise; }
});

/**
 * Add a listener that will be called
 * every time the service broadcasts
 * a new chunk of data.
 *
 * @param {Function} callback
 */

ClientStream.prototype.listen = function(callback) {
  debug('listen', callback);
  this._.emitter.on('write', callback);
};

/**
 * Removes 'data' listener
 *
 * @param {Function} callback
 */

ClientStream.prototype.unlisten = function(callback) {
  debug('unlisten', callback);
  this._.emitter.off('write', callback);
};

/**
 * Notify the service that
 * action should be canceled
 *
 * @param {*} [reason] Optional data to be sent to service.
 */

ClientStream.prototype.cancel = function(reason) {
  debug('cancel', reason);

  var canceled = utils.deferred();
  var client = this._.client;
  var id = this._.id;

  client.request('streamcancel', {
    id: id,
    reason: reason
  }).then(function(data) {
    delete client._activeStreams[id];
    canceled.resolve(data);
  }).catch(function(e) {
    // should delete the `_activeStreams`
    // reference even if it didn't succeed
    delete client._activeStreams[id];
    canceled.reject(e);
  });

  return canceled.promise;
};

/**
 * Initialize a new `ClientStreamPrivate`.
 *
 * @param {Object} options
 * @private
 */

function ClientStreamPrivate(options) {
  this.id = options.id;
  this.client = options.client;
  this.closed = utils.deferred();
  this.emitter = new Emitter();
  debug('initialized');
}

/**
 * Used internally by Client when
 * it receives an 'abort' event
 * from the service.
 *
 * @private
 */

ClientStreamPrivate.prototype.abort = function(reason) {
  debug('abort', reason);
  this.closed.reject(reason);
};

/**
 * Used internally by Client when
 * it receives a 'close' event
 * from the service.
 *
 * @private
 */

ClientStreamPrivate.prototype.close = function() {
  debug('close');
  this.closed.resolve();
};

/**
 * Used internally by Client when
 * it receives a 'write' event
 * from the service.
 *
 * @private
 */

ClientStreamPrivate.prototype.write = function(data) {
  debug('write', data);
  this.emitter.emit('write', data);
};

},{"../emitter":5,"../utils":11}],5:[function(require,module,exports){
'use strict';

/**
 * Exports
 */

module.exports = Emitter;

/**
 * Simple logger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[emitter]') : function(){};

function Emitter() {}

Emitter.prototype = {
  emit: function(type, data) {
    debug('emit', type, data);
    if (!this._callbacks) return;
    var fns = this._callbacks[type] || [];
    fns = fns.concat(this._callbacks['*'] || []);
    for (var i = 0; i < fns.length; i++) {
      fns[i].call(this, data, type);
    }
  },

  on: function(type, callback) {
    debug('on', type, callback);
    if (!this._callbacks) this._callbacks = {};
    if (!this._callbacks[type]) this._callbacks[type] = [];
    this._callbacks[type].push(callback);
  },

  off: function(type, callback) {
    if (!this._callbacks) return;
    var typeListeners = this._callbacks[type];
    if (!typeListeners) return;
    var i = typeListeners.indexOf(callback);
    if (~i) typeListeners.splice(i, 1);
  }
};

},{}],6:[function(require,module,exports){

'use strict';

/**
 * Dependencies
 */

var ChildThread = require('./child-thread');
var Messenger = require('./messenger');

/**
 * Exports
 */

module.exports = Manager;

/**
 * Simple logger
 *
 * @type {Function}
 */
var debug = 0 ? console.log.bind(console, '[Manager]') : function() {};

/**
 * Global 'manager' channel
 *
 * @type {BroadcastChannel}
 */
var channel = new BroadcastChannel('threadsmanager');


function Manager(descriptors) {
  if (!(this instanceof Manager)) return new Manager(descriptors);
  new ManagerInternal(descriptors);
}

function ManagerInternal(descriptors) {
  this.id = 'threadsmanager';
  this.readMessages = new Array(10);
  this.processes = { id: {}, src: {} };
  this.pending = { connects: {} };
  this.activeServices = {};
  this.registry = {};

  this.messenger = new Messenger(this.id, 'manager')
    .handle('connect', this.onconnect, this);

  channel.addEventListener('message', this.messenger.parse);

  this.register(descriptors);
  debug('intialized');
}

ManagerInternal.prototype.register = function(descriptors) {
  debug('register', descriptors);
  for (var name in descriptors) {
    descriptors[name].name = name;
    this.registry[name] = descriptors[name];
  }
};

ManagerInternal.prototype.onbroadcast = function(broadcast) {
  debug('on broadcast', broadcast);
  this.emit(broadcast.type, broadcast.data);
};

/**
 * Run when a client attempts to connect.
 *
 * If a contract is found in the service
 * descriptor we pass it to the service
 * along with the connect request.
 *
 * @param  {Object} data {service,client,contract}
 * @private
 */
ManagerInternal.prototype.onconnect = function(request) {
  debug('on connect', request);
  var data = request.data;
  var descriptor = this.registry[data.service];

  if (!descriptor) return debug('"%s" not managed here', data.service);

  var self = this;
  var client = data.client;
  var contract = descriptor.contract;
  var thread = this.getThread(descriptor);

  request.respond(
    thread.getService(descriptor.name)
      .then(function(service) {
        return self.connect(service, client, contract); })
      .catch(function(e) { throw new Error(e); }));
};

ManagerInternal.prototype.connect = function(service, client, contract) {
  debug('connect', service, client, contract);
  return this.messenger.request(channel, {
    type: 'connect',
    recipient: service.id,
    data: {
      client: client,
      service: service.name,
      contract: contract
    }
  });
};

ManagerInternal.prototype.onclientdisconnected = function(msg) {
  debug('on client disconnected', msg);
};

ManagerInternal.prototype.onclientconnected = function(msg) {
  debug('on client connected', msg);
};

ManagerInternal.prototype.getThread = function(descriptor) {
  debug('get thread', descriptor, this.processes);
  var thread = this.processes.src[descriptor.src];
  return thread || this.createThread(descriptor);
};

ManagerInternal.prototype.createThread = function(descriptor) {
  debug('create thread', descriptor);
  var process = new ChildThread(descriptor);
  this.processes.src[process.src] = process;
  this.processes.id[process.id] = process;
  return process;
};

},{"./child-thread":2,"./messenger":7}],7:[function(require,module,exports){
'use strict';

/**
 * Dependencies
 */

var utils = require('./utils');

/**
 * Mini Logger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[messenger]') : function() {};

/**
 * Message
 */

module.exports = Messenger;

/**
 * Instantiate a new `Messenger`.
 *
 * A Messenger is a common interface to
 * send and receive messages over a channel
 * that connects threads.
 *
 * It has no concept of `Client` or `Service`
 * it simply acts as a sender and reciever
 * of messages.
 *
 * @param {Number} id
 * @name {String} name (optional) passed to debug() logs
 */

function Messenger(id, name) {
  this.id = id;
  this.name = name;
  this.handlers = {};
  this.pending = {};
  this.history = new Array(10);
  this.parse = this.parse.bind(this);
  debug('initialized', this.name);
}

/**
 * Register a handler for a message type.
 *
 * NOTE: Only one handler per message type allowed.
 *
 * @param  {String}   type
 * @param  {Function} fn
 * @param  {Object}   ctx
 * @return {Messenger} for chaining
 */

Messenger.prototype.handle = function(type, fn, ctx) {
  this.handlers[type] = { fn: fn, ctx: ctx };
  return this;
};

/**
 * Unregister a handler for a message type.
 *
 * As we only accept one handler per message
 * type, a callback function is not required.
 *
 * @param  {String} type
 * @return {Messenger} for chaining
 */

Messenger.prototype.unhandle = function(type) {
  delete this.handlers[type];
  return this;
};

/**
 * Parses raw message event objects
 * an triggers handlers if validity
 * checks are passed.
 *
 * Users of `Message` should wire this
 * up to their Channel's `.onmessage`
 * callback.
 *
 * @param  {Event} e
 * @public
 */

Messenger.prototype.parse = function(e) {
  var message = e.data;

  if (!this.isRecipient(message)) return;
  if (this.hasRead(message)) return;

  debug('parse', this.name, e);
  var handler = this['on' + message.type];

  if (handler) {
    handler.call(this, e);
    this.read(message);
  }
};

/**
 * Request is used to send a message to
 * a channel and expects a response.
 *
 * The returned `Promise` will fulfill
 * with the value passed to `request.respond()`
 * by the first responding handler.
 *
 * @param  {Object} channel [BroadcastChannel, Window, ChildThread]
 * @param  {Object} params  {recipient, type, data}
 * @return {Promise}
 */

Messenger.prototype.request = function(channel, params) {
  debug('request', this.name, params);
  var deferred = utils.deferred();
  var id = utils.uuid();

  send(channel, {
    type: 'request',
    sender: this.id,
    recipient: params.recipient,
    data: {
      id: id,
      type: params.type,
      data: params.data
    }
  });

  this.pending[id] = deferred;
  return deferred.promise;
};

/**
 * Push is used to send a one-way message
 * to a channel and doesn't provide a
 * way to respond.
 *
 * @param  {Object} channel [BroadcastChannel,Window,ChildThread]
 * @param  {Object} params  {recipient,type,data}
 */

Messenger.prototype.push = function(channel, params) {
  debug('push', channel, params);
  send(channel, {
    type: 'push',
    sender: this.id,
    recipient: params.recipient,
    data: {
      type: params.type,
      data: params.data
    }
  });
};

/**
 * Handles incoming 'request' messages.
 *
 * It attempts to find a matching handler,
 * if found it calls it passing a `Request`
 * object that the handler can use to respond.
 *
 * In the event that a handler throws an
 * exception, this will be caught and
 * we .respond() on the handler's behalf.
 *
 * @param  {Event} e Raw message event.
 * @private
 */

Messenger.prototype.onrequest = function(e) {
  debug('on request', e);
  var request = new Request(e);
  var handler = this.handlers[request.type];

  if (!handler) return;

  try { handler.fn.call(handler.ctx, request); }
  catch (e) {
    request.respond(e);
    console.error(e); // Should this throw?
  }
};

/**
 * Handles incoming 'response' messages.
 *
 * Attempts to find a pending request
 * that matches the `requestId` of
 * the response. If found it resolves
 * or rejects the `Promise` based on
 * the response result.
 *
 * @param  {Event} e Raw message event
 * @private
 */

Messenger.prototype.onresponse = function(e) {
  debug('on response', this.name, response);
  var message = e.data;
  var response = message.data;
  var requestId = response.request;
  var promise = this.pending[requestId];

  if (!promise) return debug('no promise', this.pending);

  var result = response.result;
  var method = {
    'fulfilled': 'resolve',
    'rejected': 'reject'
  }[result.state];

  // The value resided under a different
  // key depending on whether the promise
  // was 'rejected' or 'resolved'
  var value = result.value || result.reason;
  promise[method](value);

  // Clean up
  delete this.pending[requestId];
};

/**
 * Handles incoming 'push' messages.
 *
 * Attempts to find a handler that matches
 * the push 'type' and calls it with the
 * data passed.
 *
 * The logic is a lot simpler than onrequest
 * and onresponse as `.push()` doesn't
 * expect a reply.
 *
 * We could kill `.push()` and use `.request()`
 * for everything, but that means that either
 * we'd have to send responses for all
 * messages (even when not required) or
 * we'd have to expire requests in
 * `this.pending`.
 *
 * Overall `.push()` is a more efficient
 * way to send messages.
 *
 * @param  {Event} e Raw message event
 */

Messenger.prototype.onpush = function(e) {
  var message = e.data;
  var push = message.data;
  debug('on push', push);
  var handler = this.handlers[push.type];
  if (handler) handler.fn.call(handler.ctx, push.data);
};

/**
 * Check if this messenger is an
 * intended recipient.
 *
 * @param  {Object}  message
 * @return {Boolean}
 */

Messenger.prototype.isRecipient = function(message) {
  var recipient = message.recipient;
  return recipient === this.id || recipient === '*';
};

/**
 * Keeping track of read messages means
 * that we'll never accidentally read
 * the same message twice.
 *
 * @param  {Object} message
 */

Messenger.prototype.read = function(message) {
  this.history.push(message.id);
  this.history.shift();
};

/**
 * Check if the message has already been read.
 *
 * @param  {Object}  message
 * @return {Boolean}
 */

Messenger.prototype.hasRead = function(message) {
  return !!~this.history.indexOf(message.id);
};

/**
 * Create a new `Request`.
 *
 * A request is an object that represents an
 * incoming request message. It provides
 * the receiver with an opportunity to
 * `.respond('result')`.
 *
 * Any message handlers that match an
 * incoming request `type` will be passed
 * one of these `Request` objects.
 *
 * @param {MessageEvent} e Raw message Event to parse
 */

function Request(e) {
  var message = e.data;
  var request = message.data;

  this.id = request.id;
  this.channel = e.source || e.target;
  this.sender = message.sender;
  this.type = request.type;
  this.data = request.data;
  this.responded = false;
}


/**
 * Respond to a request.
 *
 * The result passed to this function
 * will be sent back to the sender.
 *
 * If an `Error` is passed back the
 * pending `Promise` will be rejected
 * on the sender's end.
 *
 * @param  {*} result
 */

Request.prototype.respond = function(result) {
  debug('respond');
  if (this.responded) return;
  this.responded = true;

  var self = this;

  // Repsond with rejection when result is an `Error`
  if (result instanceof Error) reject(result);

  // Call the handler and make
  // sure return value is a promise
  Promise.resolve(result).then(resolve, reject);

  function resolve(value) {
    debug('resolved', value);
    respond({
      state: 'fulfilled',
      value: value
    });
  }

  function reject(err) {
    debug('rejected', err.message);
    respond({
      state: 'rejected',
      reason: err.message || err
    });
  }

  function respond(result) {
    send(self.channel, {
      type: 'response',
      recipient: self.sender,
      data: {
        request: self.id,
        result: result
      }
    });
  }
};

/**
 * Send a message via a particular channel.
 *
 * A 'channel' is an object with a `.postMessage`
 * method. In our case `iframe.contentWindow`,
 * `BroadCastChannel` or `ChildThread`.
 *
 * @param  {Object} channel
 * @param  {Object} params
 * @private
 */

function send(channel, params) {
  debug('send', channel, params);
  var isWindow = channel.constructor.name === 'Window';
  var message = {
    type: params.type,
    id: utils.uuid(),
    recipient: params.recipient || '*',
    sender: params.sender,
    data: params.data
  };

  // Window and BroadcastChannel take different arguments
  if (isWindow) channel.postMessage(message, '*');
  else channel.postMessage(message);
}

},{"./utils":11}],8:[function(require,module,exports){
'use strict';

/**
 * Dependencies
 */

var thread = require('../thread-global');
var Messenger = require('../messenger');
var ServiceStream = require('./stream');
var utils = require('../utils');

/**
 * exports
 */

module.exports = Service;
module.exports.Stream = ServiceStream; // exposed for testing

/**
 * Mini Logger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[service]') : function(){};

/**
 * Global broadcast channel that
 * the Manager can use to pair
 * a Client with a Service.
 *
 * @type {BroadcastChannel}
 */

var manager = new BroadcastChannel('threadsmanager');

/**
 * Initialize a new `Service`
 *
 * @param {String} name
 */

function Service(name) {
  if (!(this instanceof Service)) return new Service(name);
  this.name = name;
  this.private = new ServicePrivate(this);
  debug('initialized', this.name);
}

/**
 * Register a method that will be
 * exposed to all the clients.
 *
 * @param {String} name Method name
 * @param {Function} fn Implementation
 */

Service.prototype.method = function(name, fn) {
  this.private.addMethod(name, fn);
  return this;
};

/**
 * Register a method that sends data through a writable stream.
 *
 * @param {String} name Method name
 * @param {Function} fn Implementation
 */

Service.prototype.stream = function(name, fn) {
  this.private.addStream(name, fn);
  return this;
};

/**
 * Register a contract that will be used
 * to validate method calls and events.
 *
 * @param {Object} contract
 */

Service.prototype.contract = function(contract) {
  this.private.setContract(contract);
  return this;
};

/**
 * Broadcast message to all the clients.
 *
 * @param {String} type Event name.
 * @param {*} data Payload to be transmitted.
 */

Service.prototype.broadcast = function(type, data) {
  this.private.broadcast(type, data);
  return this;
};

/**
 * All the logic is contained inside
 * this 'private' class. Public methods
 * on `Service` proxy to `ServicePrivate`.
 *
 * @param {Service} service
 * @param {String} name
 */

function ServicePrivate(service) {
  debug('initialize', service);

  this.public = service;
  this.name = service.name;
  this.id = utils.uuid();
  this.contract = null;
  this.methods = {};
  this.channels = {};
  this.streams = {};
  this.activeStreams = {};

  this.messenger = new Messenger(this.id, '[service]')
    .handle('connect', this.onconnect, this)
    .handle('stream', this.onstream, this)
    .handle('streamcancel', this.onstreamcancel, this)
    .handle('method', this.onmethod, this)
    .handle('disconnect', this.ondisconnect, this)
    .handle('disconnected', this.ondisconnected, this);

  this.listen();

  // Don't declare service ready until
  // any pending tasks in the event-loop
  // have completed. Namely any pending
  // 'connect' events for `SharedWorkers`.
  // If we broadcast the 'serviceready'
  // event before the thread-parent has
  // 'connected', it won't be heard.
  setTimeout(this.ready.bind(this));
}

/**
 * Called when a client calls
 * a service's method.
 *
 * @param  {Object} method
 * @return {*}
 */

ServicePrivate.prototype.onmethod = function(request) {
  debug('method', request.data);
  var method = request.data;
  var fn = this.methods[method.name];
  if (!fn) throw error(4, method.name);
  this.checkMethodCall(method);
  var result = fn.apply(this.public, method.args);
  request.respond(result);
};

/**
 * Called during `client.stream()`
 *
 * @param {Object} method
 * @param {String} method.name Name of the function to be executed
 * @param {String} method.id Stream Id, used to sync client and service streams
 * @param {Object} request Request object
 */

ServicePrivate.prototype.onstream = function(request) {
  debug('stream', request.data);
  var data = request.data;
  var fn = this.streams[data.name];
  var client = request.sender;

  if (!fn) throw error(6, data.name);

  var id = data.id;
  var stream = new ServiceStream({
    id: id,
    channel: this.channels[client],
    serviceId: this.id,
    clientId: client
  });

  this.activeStreams[id] = stream;

  // always pass stream object as first
  // argument to simplify the process
  fn.apply(this.public, [stream].concat(data.args));

  // stream doesn't return anything on purpose,
  // we create another stream object
  // on the client during request
  request.respond();
};

/**
 * Called when client requests for `streamcancel`
 *
 * @param {*} data Data sent from client (reason for cancelation).
 * @return {Promise}
 * @private
 */

ServicePrivate.prototype.onstreamcancel = function(request) {
  var data = request.data;
  var id = data.id;
  var stream = this.activeStreams[id];
  delete this.activeStreams[id];
  request.respond(stream._.cancel(data.reason));
};

/**
 * Once the service is 'ready', we
 * postMessage out of the global
 * thread scope so that the parent
 * of the thread ('manager' or manual)
 * knows that they can proceed with
 * the connection request.
 *
 * @private
 */

ServicePrivate.prototype.ready = function() {
  debug('ready');
  thread.serviceReady(this);
};

/**
 * Runs on an inbound connection
 * attempt from a client.
 *
 * A new dedicated `BroadcastChannel`
 * is opened for each client.
 *
 * A 'connected' message is sent down the
 * new client channel to confirm the
 * connection.
 *
 * @param  {Object} data
 */

ServicePrivate.prototype.onconnect = function(request) {
  var data = request.data;
  var client = data.client;
  var contract = data.contract;
  var service = data.service;

  if (!client) return;
  if (service !== this.name) return;
  if (this.channels[client]) return;

  debug('on connect', this.id, data);
  var channel = new BroadcastChannel(client);
  channel.onmessage = this.messenger.parse;
  this.channels[client] = channel;

  this.setContract(contract);
  thread.connection('inbound');
  debug('connected', client);

  request.respond({
    id: this.id,
    name: this.name
  });
};

ServicePrivate.prototype.ondisconnect = function(request) {
  var client = request.data;

  if (!client) return;
  if (!this.channels[client]) return;

  debug('on disconnect', client);
  var deferred = utils.deferred();

  // TODO: Check there are no requests/methods
  // pending for this client, before disconnecting.
  deferred.resolve();

  thread.disconnection('inbound');
  request.respond(deferred.promise);
};

ServicePrivate.prototype.ondisconnected = function(client) {
  debug('disconnected', client);
  this.channels[client].close();
  delete this.channels[client];
};

ServicePrivate.prototype.setContract = function(contract) {
  if (!contract) return;
  this.contract = contract;
  debug('contract set', contract);
};

/**
 * Add a method to the method registry.
 *
 * TODO: We should check the the
 * `name` and function signature
 * match anything defined in the
 * contract. Or perhaps this could
 * be done in `.setContract()`?
 *
 * @param {String}   name
 * @param {Function} fn
 */
ServicePrivate.prototype.addMethod = function(name, fn) {
  this.methods[name] = fn;
};


/**
 * Add a method to the stream registry.
 *
 * @param {String}   name
 * @param {Function} fn
 */

ServicePrivate.prototype.addStream = function(name, fn) {
  this.streams[name] = fn;
};

/**
 * Check a method call matches a registered
 * method and that the arguments passed
 * adhere to a defined contract.
 *
 * Throws an error when invalid.
 *
 * @param  {Object} method
 */

ServicePrivate.prototype.checkMethodCall = function(method) {
  debug('check method call', method);

  var name = method.name;
  var args = method.args;

  if (!this.contract) return;

  var signature = this.contract.methods[name];
  var e;

  if (!signature) e = error(1, name);
  else if (args.length !== signature.length) e = error(2, name, signature.length);
  else if (!utils.typesMatch(args, signature)) e = error(5);

  if (e) throw e;
};

/**
 * Listens for incoming messsages from
 * the `thread` global and `manager` channel.
 *
 * `this.onmessage` filters out messages
 * that aren't intended for this instance.
 *
 * @private
 */

ServicePrivate.prototype.listen = function() {
  manager.addEventListener('message', this.messenger.parse);
  thread.on('message', this.messenger.parse);
};

/**
 * Broadcast a message to all
 * connected clients.
 *
 * @param  {String} type
 * @param  {*} data to pass with the event
 */

ServicePrivate.prototype.broadcast = function(type, data) {
  debug('broadcast', type, data);
  for (var client in this.channels) {
    this.messenger.push(this.channels[client], {
      type: 'broadcast',
      recipient: client,
      data: {
        type: type,
        data: data
      }
    });
  }
};

/**
 * Utils
 */

function error(id) {
  /*jshint maxlen:false*/
  var args = [].slice.call(arguments, 1);
  return new Error({
    1: 'method "' + args[0] + '" not defined in the contract',
    2: 'expected method " ' + args[0] + '" to be called with ' + args[1]+ ' arguments',
    3: 'unknown request type: "' + args[0] + '"',
    4: 'method "' + args[0] + '" doesn\'t exist',
    5: 'arguments types don\'t match contract',
    6: 'stream "' + args[0] + '" doesn\'t exist',
  });
}

},{"../messenger":7,"../thread-global":10,"../utils":11,"./stream":9}],9:[function(require,module,exports){
'use strict';

/**
 * Dependencies
 */

var Messenger = require('../messenger');

/**
 * Exports
 */

module.exports = ServiceStream;

/**
 * Mini Logger
 *
 * @type {Function}
 */

var debug = 0 ? console.log.bind(console, '[ServiceStream]') : function() {};

/**
 * Writable Stream instance passed to the
 * `service.stream` implementation
 *
 * @param {Object} options
 * @param {String} options.id Stream ID used to sync client and service streams
 * @param {BroadcastChannel} options.channel Channel used to postMessage
 * @param {String} options.serviceId ID of the service
 * @param {String} options.clientId ID of client that should receive message
 */

function ServiceStream(options) {
  this._ = new PrivateServiceStream(this, options);
}

/**
 * Services that allows clients to
 * cancel the operation before it's
 * complete should override the
 * `stream.cancel` method.
 *
 * @param {*} [reason] Data sent from client about the cancellation
 * @returns {(Promise|*)}
 */

ServiceStream.prototype.cancel = function(reason) {
  var err = new TypeError('service should implement stream.cancel()');
  return Promise.reject(err);
};

/**
 * Signal to client that action was
 * aborted during the process, this
 * should be used as a way to
 * communicate errors.
 *
 * @param {*} [data] Reason of failure
 * @returns {Promise}
 */

ServiceStream.prototype.abort = function(data) {
  debug('abort', data);
  return this._.post('abort', 'aborted', data);
};

/**
 * Sends a chunk of data to the client.
 *
 * @param {*} data Chunk of data to be sent to client.
 * @returns {Promise}
 */

ServiceStream.prototype.write = function(data) {
  debug('write', data);
  return this._.post('write', 'writable', data);
};

/**
 * Closes the stream, signals that
 * action was completed with success.
 *
 * According to whatwg streams spec,
 * WritableStream#close() doesn't send data.
 *
 * @returns {Promise}
 */

ServiceStream.prototype.close = function() {
  debug('close');
  return this._.post('close', 'closed');
};

/**
 * Initialize a new `ClientStreamPrivate`.
 *
 * @param {ServiceStream} target
 * @param {Object} options
 * @private
 */

function PrivateServiceStream(target, options) {
  this.target = target;
  this.id = options.id;
  this.channel = options.channel;
  this.client = options.clientId;
  this.state = 'writable';
  this.messenger = new Messenger(options.serviceId, '[ServiceStream]');
  debug('initialized', target, options);
}

/**
 * Validate the internal state to avoid
 * passing data to the client when stream
 * is already 'closed/aborted/canceled'.
 *
 * Returns a Stream to simplify the 'cancel'
 * & 'post' logic since they always need
 * to return promises.
 *
 * @param {String} actionName
 * @param {String} state
 * @returns {Promise}
 * @private
 */

PrivateServiceStream.prototype.validateState = function(actionName, state) {
  if (this.state !== 'writable') {
    var msg = 'Can\'t ' + actionName + ' on current state: ' + this.state;
    return Promise.reject(new TypeError(msg));
  }

  this.state = state;
  return Promise.resolve();
};

/**
 * Validate the current state and
 * call cancel on the target stream.
 *
 * Called by the Service when client
 * sends a 'streamcancel' message.
 *
 * @param {*} [reason] Reason for cancelation sent by the client
 * @returns {Promise}
 * @private
 */

PrivateServiceStream.prototype.cancel = function(reason) {
  return this.validateState('cancel', 'canceled').then(function() {
    return this.target.cancel(reason);
  }.bind(this));
};

/**
 * Validate the current state and post message to client.
 *
 * @param {String} type 'write', 'abort' or 'close'
 * @param {String} state 'writable', 'aborted' or 'closed'
 * @param {*} [data] Data to be sent to the client
 * @returns {Promise}
 * @private
 */

PrivateServiceStream.prototype.post = function(type, state, data) {
  debug('post', type, state, data);
  return this.validateState(type, state).then(function() {
    debug('validated', this.channel);
    this.messenger.push(this.channel, {
      type: 'streamevent',
      recipient: this.client,
      data: {
        id: this.id,
        type: type,
        data: data
      }
    });
  }.bind(this));
};

},{"../messenger":7}],10:[function(require,module,exports){
'use strict';

/**
 * Dependencies
 */

var Messenger = require('./messenger');
var emitter = require('./emitter');
var utils = require('./utils');

/**
 * Locals
 */

var debug = 0 ? console.log.bind(console, '[ThreadGlobal]') : function() {};

const ERRORS = {
  1: 'Unknown connection type',
  2: 'Service already defined'
};

/**
 * Extend `Emitter`
 */

ThreadGlobal.prototype = Object.create(emitter.prototype);

/**
 * Initialize a new `ThreadGlobal`
 *
 * @private
 */
function ThreadGlobal() {
  this.id = getThreadId();
  this.type = utils.env();
  this.isRoot = isRoot();
  this.manager = new BroadcastChannel('threadsmanager');
  this.ports = [];
  this.services = {};
  this.connections = {
    inbound: 0,
    outbound: 0
  };

  this.messenger = new Messenger(this.id, '[thread-global]')
    .handle('ping', this.onPing, this);

  this.onmessage = this.onmessage.bind(this);
  this.listen();
  this.ready();

  debug('initialized', this.id, this.type, this.isRoot);
}

/**
 * Listens for incoming messages.
 *
 * @private
 */
ThreadGlobal.prototype.listen = function() {
  debug('listen');
  switch (this.type) {
    case 'sharedworker':
      addEventListener('connect', function(e) {
        debug('port connect');
        var port = e.ports[0];
        this.ports.push(port);
        port.onmessage = this.onmessage;
        port.start();
      }.bind(this));
    break;
    case 'worker':
    case 'window':
      addEventListener('message', this.onmessage);
  }
};

/**
 * Ping the outside world to let them
 * know the thread is ready.
 *
 * @private
 */
ThreadGlobal.prototype.ready = function() {
  debug('ready', this.id);
  this.messenger.push(this, {
    type: 'threadready',
    data: this.serialize()
  });
};

/**
 * Respond when the outside world asks
 * if we're ready.
 *
 * TODO: This callback may not be required.
 *
 * @private
 */
ThreadGlobal.prototype.onPing = function(request) {
  debug('on ping');
  request.respond(this.serialize());
};

ThreadGlobal.prototype.serialize = function() {
  return {
    id: this.id,
    services: this.services
  };
};

/**
 * When a message is sent to this thread
 * we re-emit the message internally.
 *
 * The thread-global abstracts away the
 * the complexity of message listening
 * so that `Service` can just do:
 *
 *   thread.on('message', ...);
 *
 * and not care what thread type
 * it's running in.
 *
 * @param  {Event} e
 * @private
 */
ThreadGlobal.prototype.onmessage = function(e) {
  debug('on message', e);
  this.messenger.parse(e);
  this.emit('message', e);
};

/**
 * Keeps a record of what services are
 * running inside this thread.
 *
 * This makes the assumption that
 *
 * TODO: If services are destroyed we
 * should remove it from this list.
 *
 * @param  {Service} service
 */
ThreadGlobal.prototype.serviceReady = function(service) {
  debug('service ready', service);
  if (this.services[service.name]) {
    throw new Error('Service "' + service.name + '" already defined');
  }

  this.services[service.name] = {
    id: service.id,
    name: service.name
  };

  this.messenger.push(this, {
    type: 'serviceready',
    data: this.services[service.name]
  });
};

/**
 * Message the thread parent
 * (instanceof ChildThread) to
 * inform them of something that
 * has happened inside the thread.
 *
 * The Manager could have created
 * the `ChildThread` or it could
 * have been created manually by
 * the user.
 *
 * @param  {Message} message
 * @public
 */
ThreadGlobal.prototype.postMessage = function(message) {
  debug('postMessage (%s)', this.type, message);
  switch (this.type) {
    case 'worker':
      postMessage(message); break;
    case 'sharedworker':
      this.ports.forEach(function(port) { port.postMessage(message); });
      break;
    case 'window':
      window.parent.postMessage(message, '*'); break;
  }
};

/**
 * Increment the connection count.
 *
 * @param  {String} type  ['incoming','outgoing']
 */
ThreadGlobal.prototype.connection = function(type) {
  if (!(type in this.connections)) throw Error(ERRORS[1]);
  this.connections[type]++;
  debug('connection', type, this.connections[type]);
  this.check();
};

/**
 * Decrement the connection count.
 *
 * @param  {String} type  ['incoming','outgoing']
 */
ThreadGlobal.prototype.disconnection = function(type) {
  if (!(type in this.connections)) throw Error(ERRORS[1]);
  this.connections[type]--;
  debug('disconnection', type, this.connections[type]);
  this.check();
};

/**
 * Checks to see if the thread is
 * 'redundant', broadcasting an event
 * to notify the outside world if so.
 *
 * @private
 */
ThreadGlobal.prototype.check = function() {
  if (this.isRedundant()) {
    debug('redundant');
    this.messenger.push(this, { type: 'redundant' });
  }
};

/**
 * A thread is 'redundant' when it has
 * no clients and it's not a 'root'.
 *
 * @return {Boolean}
 */
ThreadGlobal.prototype.isRedundant = function() {
  return !this.isRoot && this.isDetached();
};

/**
 * A thread is 'detached' when
 * it has no clients.
 *
 * @return {Boolean} [description]
 */
ThreadGlobal.prototype.isDetached = function() {
  return !this.connections.inbound;
};

/**
 * Utils
 */

function getThreadId() {
  return utils.query(location.search).pid
    || (inWindow() && window.name)
    || utils.uuid();
}

function isRoot() {
  return inWindow() && window.parent === window;
}

function inWindow() {
  return typeof window !== 'undefined';
}

/**
 * Exports
 */

module.exports = new ThreadGlobal();

},{"./emitter":5,"./messenger":7,"./utils":11}],11:[function(require,module,exports){
'use strict';

/**
 * Create a UUID string.
 *
 * @return {String}
 */

exports.uuid = function (){
  var timestamp = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    function onEachCharacter(c) {
      var r = (timestamp + Math.random() * 16) % 16 | 0;
      timestamp = Math.floor(timestamp / 16);
      return (c == 'x' ? r : (r&0x7|0x8)).toString(16);
    }
  );
};

/**
 * Check that the given arguments
 * match the given types.
 *
 * Example:
 *
 *   typesMatch([1, 'foo'], ['number', 'string']) //=> true
 *   typesMatch([1, 'foo'], ['string', 'number']) //=> false
 *
 * @param  {Array} args
 * @param  {Array} types
 * @return {Boolean}
 */

exports.typesMatch = function (args, types) {
  for (var i = 0, l = args.length; i < l; i++) {
    if (typeof args[i] !== types[i]) return false;
  }

  return true;
};

/**
 * Returns a Promise packaged
 * inside an object.
 *
 * This is convenient as we don't
 * have to have a load of callbacks
 * directly inside our funciton body.
 *
 * @return {Object}
 */

exports.deferred = function () {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
};

/**
 * Parses a url query string and
 * spits out a key/value object.
 *
 * Example:
 *
 *   query('?foo=bar').foo; //=> 'bar'
 *   query('?foo=bar&baz=bat').baz; //=> 'bat'
 *
 * @param  {String} string
 * @return {Object}
 */

exports.query = function(string) {
  var result = {};

  string
    .replace('?', '')
    .split('&')
    .forEach(function(param) {
      var parts = param.split('=');
      result[parts[0]] = parts[1];
    });

  return result;
};

/**
 * Returns type of environment
 * the current script is running in.
 *
 * @return {String}
 */

exports.env = function() {
  return {
    'Window': 'window',
    'SharedWorkerGlobalScope': 'sharedworker',
    'DedicatedWorkerGlobalScope': 'worker',
    'ServiceWorkerGlobalScope': 'serviceworker'
  }[self.constructor.name] || 'unknown';
};

},{}]},{},[1])(1)
});