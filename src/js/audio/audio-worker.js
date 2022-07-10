var window = self;
importScripts('../audio-min.js');

var deinterleave = function(buffer, asset) {
    var channels = asset.format.channelsPerFrame,
        len = buffer.length / channels;

    var result = new Float32Array(len * channels);

    for(var sample = 0; sample < len; sample++) {
        for(var channel = 0; channel < channels; channel++) {
            result[channel*len + sample] = buffer[(sample)*channels + channel];
        }
    }
    return result;
}

self.addEventListener('message', function(e) {
    if(!e.data.ogg) {
        importScripts('../ogg.js', '../vorbis.js', '../opus.js');
    }
    if(!e.data.mp3) {
        importScripts('../mpg123.js');
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
            error: String(error)},
            [arrayBuffer]);
    });

    asset.decodeToBuffer(function(buffer) {
        var fixedBuffer = deinterleave(buffer, asset);
        var raw = {array: fixedBuffer,
                   sampleRate: asset.format.sampleRate,
                   channels: asset.format.channelsPerFrame}
        self.postMessage({rawAudio : raw,
                          arrayBuffer : arrayBuffer},
                          // transfer objects to save a copy
                          [fixedBuffer.buffer, arrayBuffer]);
    });

}, false);
