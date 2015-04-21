'use strict';

const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in self;
var channel = BROADCAST_CHANNEL_SUPPORT ? new BroadcastChannel('latency') : {};

onmessage = function(evt) {
  var timestamp = evt.data;
  var now = Date.now();
  postMessage([now - timestamp, now]);
};

channel.onmessage = function(evt) {
  var timestamp = evt.data;
  var now = Date.now();
  channel.postMessage([now - timestamp, now]);
};
