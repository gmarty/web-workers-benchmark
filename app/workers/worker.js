'use strict';

var channel = 'BroadcastChannel' in self ? new BroadcastChannel('latency') : {};

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
