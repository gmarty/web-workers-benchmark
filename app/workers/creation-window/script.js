'use strict';

window.addEventListener('message', function(evt) {
  var timestamp = evt.data;
  var now = Date.now();
  evt.source.postMessage([now - timestamp, now], evt.origin);
});
