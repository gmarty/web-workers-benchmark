'use strict';

window.addEventListener('message', function(evt) {
  evt.source.postMessage(0, evt.origin);
});
