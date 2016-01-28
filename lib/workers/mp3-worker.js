// Use mp3.js and aurora.js for dev
// Use mp3-min.js for release
//importScripts('aurora.js');
//importScripts('mp3.js');
importScripts('../mp3-min.js');

// Flash value
var LAME_DELAY_START = 2258;
var LAME_DELAY_END = 0;

var deinterleaveAndTrim = function(buffer, asset) {
    // because MP3 is bad, we nuke silence
    var channels = asset.format.channelsPerFrame,
        len = buffer.length / channels;
        newLen = len - LAME_DELAY_START - LAME_DELAY_END;
        result = new Float32Array(newLen * channels);
        
    for(var sample = 0; sample < newLen; sample++) {
        for(var channel = 0; channel < channels; channel++) {
            result[channel*newLen + sample] = buffer[(sample+LAME_DELAY_START)*channels + channel];
        }
    }
    return result;
}

self.addEventListener('message', function(e) {
    // To see if things are working, we can ping the worker
    if(e.data.ping) {
        self.postMessage({ping: true});
        return;
    }
    
    var arrayBuffer = e.data;
    
    var asset = AV.Asset.fromBuffer(arrayBuffer);
    // Any errors are thrown up the chain to our Promises
    
    asset.decodeToBuffer(function(buffer) {
        var fixedBuffer = deinterleaveAndTrim(buffer, asset);
        var raw = {array: fixedBuffer,
                   sampleRate: asset.format.sampleRate,
                   channels: asset.format.channelsPerFrame}
        self.postMessage({rawAudio : raw,
                          arrayBuffer : arrayBuffer},
                          // transfer objects to save a copy
                          [fixedBuffer.buffer, arrayBuffer]);
    });

}, false);