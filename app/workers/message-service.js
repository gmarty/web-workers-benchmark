'use strict';

importScripts('../../components/threads/threads.js');

threads.service('message-service', {
  ping: function(obj) {
    var object = obj.m;
    var timestamp = obj.t;
    var size = obj.s;
    var now = Date.now();
    return {
      m: object,
      t: [now - timestamp, now],
      s: size
    };
  }
});
