'use strict';

importScripts('../../bower_components/threads/threads.js');

threads.service('latency-service', {
  ping: function(timestamp) {
    var now = Date.now();
    return [now - timestamp, now];
  }
});
