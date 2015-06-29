'use strict';

importScripts('../../components/threads/threads.js');

threads.service('message-service')
  .method('ping', function(obj) {
    return obj;
  });
