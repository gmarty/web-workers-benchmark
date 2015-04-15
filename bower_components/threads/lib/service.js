
'use strict';

/**
 * Dependencies
 */

var thread = require('./thread-global');
var utils = require('./utils');

/**
 * exports
 */

module.exports = Service;

/**
 * Mini Logger
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
 * Known request types.
 * @type {Array}
 */
const REQUEST_TYPES = [
  'method',
  'disconnect'
];

/**
 * Possible errors.
 * @type {Object}
 */
const ERRORS = {
  1: 'method not defined in the contract',
  2: 'arguments.length doesn\'t match contract',
  3: 'unknown request type',
  4: 'method doesn\'t exist',
  5: 'arguments types don\'t match contract'
};

function Service(name, methods, contract) {
  if (!(this instanceof Service)) return new Service(name, methods, contract);

  // Accept a single object argument
  if (typeof name === 'object') {
    contract = name.contract;
    methods = name.methods;
    name = name.name;
  }

  var internal = new ServiceInternal(this, name, methods, contract);
  this.broadcast = internal.broadcast.bind(internal);
}

function ServiceInternal(external, name, methods, contract) {
  debug('initialize', name, methods, contract);

  this.external = external;
  this.id = utils.uuid();
  this.name = name;
  this.contract = contract;
  this.methods = methods;
  this.channels = {};

  // Create a message factory that outputs
  // messages in a standardized format.
  this.message = new utils.Messages(this, this.id, [
    'connect',
    'disconnected',
    'request'
  ]);

  this.listen();

  // Don't declare service ready until
  // any pending tasks in the event-loop
  // have completed. Namely any pending
  // 'connect' events for `SharedWorkers`.
  // If we broadcast the 'serviceready'
  // event before the thread-parent has
  // 'connected', it won't be heard.
  setTimeout(function() { this.ready(); }.bind(this));
  debug('initialized', this.name);
}

/**
 * Call the corresponding method and
 * respond with a 'serialized' promise.
 *
 * @param  {Object} request
 */
ServiceInternal.prototype.onrequest = function(request) {
  debug('on request', request);
  var type = request.type;
  var data = request.data;
  var self = this;

  // Check to insure this is a known request type
  if (!~REQUEST_TYPES.indexOf(type)) return reject(ERRORS[3]);

  // Call the handler and make
  // sure return value is a promise
  Promise.resolve()
    .then(function() { return this['on' + type](data); }.bind(this))
    .then(resolve, reject);

  function resolve(value) {
    self.respond(request, {
      state: 'fulfilled',
      value: value
    });
  }

  function reject(err) {
    debug('reject', err);
    self.respond(request, {
      state: 'rejected',
      reason: err.message || err
    });
  }
};

ServiceInternal.prototype.onmethod = function(method) {
  debug('method', method.name);
  var fn = this.methods[method.name];
  if (!fn) throw new Error(ERRORS[4]);
  this.checkMethodCall(method);
  return fn.apply(this.external, method.args);
};

ServiceInternal.prototype.respond = function(request, result) {
  debug('respond', request.client, result);
  var channel = this.channels[request.client];
  channel.postMessage(this.message.create('response', {
    recipient: request.client,
    data: {
      request: request,
      result: result
    }
  }));
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
ServiceInternal.prototype.ready = function() {
  debug('ready');
  thread.broadcast('serviceready', {
    id: this.id,
    name: this.name
  });
};

ServiceInternal.prototype.onconnect = function(data) {
  var client = data.client;
  var contract = data.contract;
  var service = data.service;

  if (!client) return;
  if (service !== this.name) return;
  debug('on connect', this.id, data);
  if (this.channels[client]) return;

  var channel = new BroadcastChannel(client);
  channel.onmessage = this.message.handle;
  this.channels[client] = channel;

  this.setContract(contract);

  channel.postMessage(this.message.create('connected', {
    recipient: client,
    data: {
      id: this.id,
      name: this.name
    }
  }));

  thread.connection('inbound');
  debug('connected', client);
};


ServiceInternal.prototype.ondisconnect = function(client) {
  if (!client) return;
  if (!this.channels[client]) return;
  debug('on disconnect', client);

  var deferred = utils.deferred();

  // TODO: Check there are no requests/methods
  // pending for this client, before disconnecting.
  deferred.resolve();

  thread.disconnection('inbound');
  return deferred.promise;
};

ServiceInternal.prototype.ondisconnected = function(client) {
  debug('disconnected', client);
  this.channels[client].close();
  delete this.channels[client];
};

ServiceInternal.prototype.setContract = function(contract) {
  if (!contract) return;
  this.contract = contract;
  debug('contract set', contract);
};

ServiceInternal.prototype.checkMethodCall = function(method) {
  debug('check method call', method);

  var name = method.name;
  var args = method.args;

  if (!this.contract) return;

  var signature = this.contract.methods[name];
  var e;

  if (!signature) e = ERRORS[1];
  else if (args.length !== signature.length) e = ERRORS[2];
  else if (!utils.typesMatch(args, signature)) e = ERRORS[5];

  if (e) throw new Error(e);
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
ServiceInternal.prototype.listen = function() {
  manager.addEventListener('message', this.message.handle);
  thread.on('message', this.message.handle);
};

ServiceInternal.prototype.broadcast = function(type, data) {
  debug('broadcast', type, data);
  for (var client in this.channels) {
    this.channels[client].postMessage(this.message.create('broadcast', {
      recipient: client,
      data: {
        type: type,
        data: data
      }
    }));
  }
};
