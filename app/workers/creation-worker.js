'use strict';

onmessage = function(evt) {
  var timestamp = evt.data;
  var now = Date.now();
  postMessage([now - timestamp, now]);
};
