'use strict';

const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in self;
var channel = BROADCAST_CHANNEL_SUPPORT ? new BroadcastChannel('message') : {};

onmessage = function(evt) {
  var object = evt.data.m;
  var timestamp = evt.data.t;
  var size = evt.data.s;
  var now = Date.now();
  postMessage({
    m: object,
    t: [now - timestamp, now],
    s: size
  });
};

channel.onmessage = function(evt) {
  var object = evt.data.m;
  var timestamp = evt.data.t;
  var size = evt.data.s;
  var now = Date.now();
  channel.postMessage({
    m: object,
    t: [now - timestamp, now],
    s: size
  });
};
