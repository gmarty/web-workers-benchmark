'use strict';

const BROADCAST_CHANNEL_SUPPORT = 'BroadcastChannel' in self;
var channel = BROADCAST_CHANNEL_SUPPORT ? new BroadcastChannel('latency') : {};

onconnect = function(evt) {
  var port = evt.ports[0];

  port.onmessage = function() {
    port.postMessage(0);
  };

  port.start();
};
