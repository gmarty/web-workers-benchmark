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
