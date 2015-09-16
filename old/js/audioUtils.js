var LAME_DELAY_START = 2258;
var LAME_DELAY_END = 1000;

// callback is given a populated song object
function loadSong(song, callback) {
    if(song.buffer) {
        callback(song);
        return;
    }
    if(song.isLoading) {
        return; // we're already trying to load this
    }
    song.isLoading = true;
    song.tmpBuf = {};
    if(song.buildUp) {
        loadAudioFile(song, true, callback);
    }
    loadAudioFile(song, false, callback);
}

function loadAudioFile(song, isBuild, callback) {
    var filename = isBuild ? song.buildUp : song.file;
    var req = new XMLHttpRequest();
    req.open('GET', filename, true);
    req.responseType = 'arraybuffer';
    req.onload = function() {
        audio.context.decodeAudioData(
            req.response,
            function(buffer) {
                if(isBuild) {
                    song.tmpBuf.build = trimMP3(buffer);
                } else {
                    song.tmpBuf.loop = trimMP3(buffer);
                }
                onSongLoad(song, callback);
            },
            function() {
                console.log('Error decoding audio "' + filename + '".');
            }
        );
    };
    req.send();
}

function onSongLoad(song, callback) {
    // if this fails, we need to wait for the other part to load
    if(song.tmpBuf.loop && (!song.buildUp || song.tmpBuf.build)) {
        if(song.buildUp) {
            song.buffer = concatenateAudioBuffers(song.tmpBuf.build, song.tmpBuf.loop);
            song.loopStart = song.tmpBuf.build.duration;
        } else {
            song.buffer = song.tmpBuf.loop;
            song.loopStart = 0;
        }
        song.loopLength = song.buffer.duration - song.loopStart;
        // free dat memory
        song.tmpBuf = null;
        song.isLoading = false;
        callback(song);
    }
}

// because MP3 is bad
function trimMP3(buffer) {
    var ret = audio.context.createBuffer(buffer.numberOfChannels, buffer.length - LAME_DELAY_START - LAME_DELAY_END, buffer.sampleRate);
    for(var i=0; i<buffer.numberOfChannels; i++) {
        var oldBuf = buffer.getChannelData(i);
        var newBuf = ret.getChannelData(i);
        for(var j=0; j<ret.length; j++) {
            newBuf[j] = oldBuf[LAME_DELAY_START + j];
        }
    }
    
    return ret;
}

function concatenateAudioBuffers(buffer1, buffer2) {
    if (!buffer1 || !buffer2) {
        console.log("no buffers!");
        return null;
    }

    if (buffer1.numberOfChannels != buffer2.numberOfChannels) {
        console.log("number of channels is not the same!");
        return null;
    }

    if (buffer1.sampleRate != buffer2.sampleRate) {
        console.log("sample rates don't match!");
        return null;
    }

    var tmp = audio.context.createBuffer(buffer1.numberOfChannels, buffer1.length + buffer2.length, buffer1.sampleRate);

    for (var i=0; i<tmp.numberOfChannels; i++) {
        var data = tmp.getChannelData(i);
        data.set(buffer1.getChannelData(i));
        data.set(buffer2.getChannelData(i),buffer1.length);
    }
    return tmp;
};