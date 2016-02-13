importScripts('../audio-min.js');

// Flash value
var LAME_DELAY_START = 2258;
var LAME_DELAY_END = 0;

var deinterleaveAndTrim = function(buffer, asset) {
    var channels = asset.format.channelsPerFrame,
        len = buffer.length / channels,
        newLen, start;
        
    // because MP3 is bad, we nuke silence
    if(asset.format.formatID == "mp3") {
        newLen = len - LAME_DELAY_START - LAME_DELAY_END;
        start = LAME_DELAY_START;
    } else {
        newLen = len;
        start = 0;
    }
    var result = new Float32Array(newLen * channels);
        
    for(var sample = 0; sample < newLen; sample++) {
        for(var channel = 0; channel < channels; channel++) {
            result[channel*newLen + sample] = buffer[(sample+start)*channels + channel];
        }
    }
    return result;
}

self.addEventListener('message', function(e) {
    if(!e.data.ogg) {
        importScripts('../oggvorbis.js');
    }
    
    // To see if things are working, we can ping the worker
    if(e.data.ping) {
        self.postMessage({ping: true});
        return;
    }
    
    var arrayBuffer = e.data.buffer;
    
    var asset = AV.Asset.fromBuffer(arrayBuffer);
    
    // On error we still want to restore the audio file
    asset.on("error", function(error) {
        self.postMessage({arrayBuffer : arrayBuffer,
            error: error},
            [arrayBuffer]);
    });
    
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