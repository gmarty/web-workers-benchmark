'use strict';

const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in self;
var channel = BROADCAST_CHANNEL_SUPPORT ? new BroadcastChannel('latency') : {};

onmessage = function() {
  postMessage(0);
};

channel.onmessage = function() {
  channel.postMessage(0);
};
