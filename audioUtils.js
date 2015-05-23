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
                    song.tmpBuf.build = trimSilence(buffer);
                } else {
                    song.tmpBuf.loop = trimSilence(buffer);
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
function trimSilence(buffer) {
    // how much silence we have
    var minSilence = buffer.length;
    var maxSilence = 0;
    for(var i=0; i<buffer.numberOfChannels; i++) {
        var tmp = buffer.getChannelData(i);
        for(var j=0; j < tmp.length; j++) {
            // end of silence
            if(tmp[j] != 0) {
                if(j < minSilence) {
                    minSilence = j;
                }
                break;
            }
        }
        // because just padding 1 end isn't enough for this codec
        for(var j=tmp.length-1; j >= 0 ; j--) {
            if(tmp[j] != 0) {
                if(j > maxSilence) {
                    maxSilence = j;
                }
                break;
            }
        }
    }
    // 1152 = one frame, makes the sync better because ID3 tags
    // take up that space or some garbage
    var ret = audio.context.createBuffer(buffer.numberOfChannels, maxSilence-minSilence-1152, buffer.sampleRate);
    for(var i=0; i<buffer.numberOfChannels; i++) {
        var oldBuf = buffer.getChannelData(i);
        var newBuf = ret.getChannelData(i);
        for(var j=0; j<ret.length; j++) {
            newBuf[j] = oldBuf[minSilence + j + 1152];
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