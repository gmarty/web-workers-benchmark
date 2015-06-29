'use strict';

importScripts('../../components/threads/threads.js');

threads.service('latency-service')
  .method('ping', function() {
    return 0;
  });
