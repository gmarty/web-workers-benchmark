'use strict';

importScripts('../../components/threads/threads.js');

threads.service('latency-service')
  .method('ping', function(timestamp) {
    var now = Date.now();
    return [now - timestamp, now];
  });
