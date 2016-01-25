// Use mp3.js and aurora.js for dev
// Use mp3-min.js for release
//importScripts('aurora.js');
//importScripts('mp3.js');
importScripts('mp3-min.js');

var decodeBuffer = function(source, callback) {
    var asset = AV.Asset.fromBuffer(source);
    asset.on("error", function(err) {
        console.log(err);
    });
    
    asset.decodeToBuffer(function(buffer) {
        var result = {array: buffer,
                      sampleRate: asset.format.sampleRate,
                      channels: asset.format.channelsPerFrame}
        callback(result);
    });
}

var finish = function(result, transferrables) {
    transferrables.push(result.loop.array.buffer);
    if(result.song.buildup) {
        transferrables.push(result.build.array.buffer);
        transferrables.push(result.song.buildup);
    }
    self.postMessage(result, transferrables);
}

self.addEventListener('message', function(e) {
    var song = e.data;
    
    // To see if things are working
    if(song.ping) {
        self.postMessage({ping: true});
        return;
    }
    
    var result = {song: song, build: null, loop: null};
    var transferrables = [result.song.sound];
    
    if(song.buildup) {
        decodeBuffer(song.buildup, function(sound) {
            result.build = sound;
            // Song is finished too
            if(result.loop) {
                finish(result, transferrables);
            }
        });
    }
    
    decodeBuffer(song.sound, function(sound) {
        result.loop = sound;
        // Either there was no build, or it's already loaded
        if(!song.buildup || (song.buildup && result.build)) {
            finish(result, transferrables);
        }
    });

}, false);