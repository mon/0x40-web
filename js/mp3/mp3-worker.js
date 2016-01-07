importScripts('aurora.js', 'mp3.js');

self.addEventListener('message', function(e) {
  self.postMessage(e.data);
}, false);