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
