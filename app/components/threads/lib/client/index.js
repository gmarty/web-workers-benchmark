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
