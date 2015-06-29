'use strict';

const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in self;
var channel = BROADCAST_CHANNEL_SUPPORT ? new BroadcastChannel('message') : {};

onmessage = function(evt) {
  postMessage(evt.data);
};

channel.onmessage = function(evt) {
  channel.postMessage(evt.data);
};
