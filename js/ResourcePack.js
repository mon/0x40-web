/* Copyright (c) 2015 William Toohey <will@mon.im>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

var debugConsole = false;
function debug() {
    if(debugConsole) {
        console.log.apply(window.console, arguments);
    }
}

function Respack(url) {
    this.songs = [];
    this.songQueue = [];
    this.images = [];
    this.imageQueue = [];
    
    this.name = "<no name>";
    this.author = "<unknown>";
    this.description = "<no description>";
    this.link = null;

    this.size = -1;
    this.downloaded = -1;
    this.enabled = true;

    this._songFile = null;
    this._songFileParsed = false;
    this._imageFile = null;
    this._infoFile = null;

    this.totalFiles = -1;

    this.file = null;
    this._completionCallback = null;
    // For zip parsing progress events
    this.progressCallback = null;
    this.filesToLoad = 0;
    this.filesLoaded = 0;
    this.loadedFromURL = false;
    
    if(url)
        this.loadFromURL(url);
}

Respack.prototype.audioExtensions = new RegExp("\\.(mp3)$", "i");
Respack.prototype.imageExtensions = new RegExp("\\.(png|gif|jpg|jpeg)$", "i");
Respack.prototype.animRegex = new RegExp("(.*?)_\\d+$");

Respack.prototype.updateProgress = function() {
    if(this.progressCallback) {
        var percent = this.filesLoaded / this.filesToLoad;
        if(this.loadedFromURL) {
            percent = (percent / 2) + 0.5;
        }
        this.progressCallback(percent, this);
    }
}

Respack.prototype.loadFromURL = function(url, callback, progress) {
    var that = this;
    
    this.loadedFromURL = true;
    
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = 'blob';
    req.onload = function() {
        that.loadBlob(req.response, callback, progress);
    };
    req.onerror = function() {
        console.log("Could not load respack at URL", url);
    }
    req.onprogress = function(event) {
        if (event.lengthComputable) {
            that.size = event.total;
            that.downloaded = event.loaded;
            var percent = event.loaded / event.total;
            if(progress) {
                progress(percent / 2, that); // because of processing too
            }
        } else {
            // Unable to compute progress information since the total size is unknown
        }
    }
    req.send();
}

Respack.prototype.loadBlob = function(blob, callback, progress, errorCallback) {
    this._completionCallback = callback;
    this.progressCallback = progress;
    var that = this;
    this.size = blob.size;
    this.file = new zip.fs.FS();
    this.file.importBlob(blob,
        function() { // success
            that.parseWholeZip();
        },
        function(error) {   // failure
            console.log("Error loading respack :", error.toString());
            that.file = null;
            if(errorCallback) {
                errorCallback(error.toString());
            }
        } 
    );
}

Respack.prototype.parseWholeZip = function() {
    // TODO might break on bad file
    console.log("Loading new respack: " + this.file.root.children[0].name);
    
    var entries = this.file.entries;
    
    this.totalFiles = 0;
    // Progress events
    this.filesToLoad = 0;
    this.filesLoaded = 0;
    
    for(var i = 0; i < entries.length; i++) {
        if(!entries[i].directory && entries[i].name) {
            this.totalFiles++;
            this.parseFile(entries[i]);
        }
    }
    
    debug("ZIP loader: trying to finish");
    this.tryFinish();
}

Respack.prototype.parseFile = function(file) {
    var name = file.name
    if (name.match(this.audioExtensions)) {
        this.parseSong(file);
        this.filesToLoad++;
    } else if (name.match(this.imageExtensions)) {
        this.parseImage(file);
        this.filesToLoad++;
    }
    else {
        switch(name.toLowerCase()) {
            case "songs.xml":
                this._songFile = file;
                break;
            case "images.xml":
                this._imageFile = file;
                break;
            case "info.xml":
                this._infoFile = file;
                break;
            default:
        }
    }
}

Respack.prototype.parseSong = function(file) {
    this.songQueue.push(file);
}

Respack.prototype.parseImage = function(file) {
    this.imageQueue.push(file);
}

Respack.prototype.parseXML = function() {
    var that = this;
    
    if (this._infoFile) {
        this._infoFile.getText(function(text) {
            text = text.replace(/&amp;/g, '&');
            text = text.replace(/&/g, '&amp;');
            that.parseInfoFile(text);
            that._infoFile = null;
            that.parseXML();
        });
        return;
    }
    if (this.songs.length > 0) {
        if (this._songFile) {
            this._songFile.getText(function(text) {
                //XML parser will complain about a bare '&', but some respacks use &amp
                text = text.replace(/&amp;/g, '&');
                text = text.replace(/&/g, '&amp;');
                that.parseSongFile(text);
                // Go to next in series
                that._songFile = null;
                that._songFileParsed = true;
                that.parseXML();
            });
            return;
        } else if(!this._songFileParsed) {
            console.log("!!!", "Got songs but no songs.xml!");
            this._songFileParsed = true;
        }
    }
    if (this.images.length > 0 && this._imageFile) {
        this._imageFile.getText(function(text) {
            text = text.replace(/&amp;/g, '&');
            text = text.replace(/&/g, '&amp;');
            that.parseImageFile(text);
            that._imageFile = null;
            that.parseXML();
        });
        return;
    }
    
    // Finally done!
    this.file = null;
    console.log("Loaded", this.name, "successfully with", this.songs.length, 
                "songs and", this.images.length, "images.");
    if(this._completionCallback) {
        this._completionCallback();
    }
}

// Save some chars
Element.prototype.getTag = function(tag, def) {
    var t = this.getElementsByTagName(tag)[0];
    return t ? t.textContent : (def ? def : null);
}

Respack.prototype.parseSongFile = function(text) {
    debug(" - Parsing songFile");
    
    var oParser = new DOMParser();
    var oDOM = oParser.parseFromString(text, "text/xml");
    if(oDOM.documentElement.nodeName !== "songs"){
        console.log("songs.xml error, corrupt file?")
        return;
    }
    
    var newSongs = [];
    // Not supported in mobile safari
    // var songsXML = oDOM.documentElement.children;
    var el = oDOM.documentElement.firstElementChild;
    for(; el; el = el.nextElementSibling) {
        var song = this.getSong(el.attributes[0].value);
        if(song) {
            song.title = el.getTag("title");
            if(!song.title) {
                song.title = "<no name>";
                debug("  WARNING!", song.name, "has no title!");
            }
            
            song.rhythm = el.getTag("rhythm");
            if(!song.rhythm) {
                song.rhythm = "..no..rhythm..";
                debug("  WARNING!!", song.name, "has no rhythm!!");
            }
            
            song.startSilence = el.getTag("startSilence");
            song.endSilence = el.getTag("endSilence");
            song.buildupLength = el.getTag("buildupLength");
            if(song.buildupLength) {
                debug("Using custom BU length:", song.buildupLength);
            }
            song.buildup = el.getTag("buildup");
            if(song.buildup) {
                debug("  Finding a buildup '" + song.buildup + "' for ", song.name);
                var build = this.getSong(song.buildup);
                if(build) {
                    song.buildup = build.sound;
                    song.buildupPlayed = false;
                    // get rid of the junk
                    this.songs.splice(this.songs.indexOf(build), 1);
                } else {
                    debug("  WARNING!", "Didn't find a buildup '" + buildup + "'!");
                }
            }
            
            song.buildupRhythm = el.getTag("buildupRhythm");
            song.source = el.getTag("source");
            
            // Because PackShit breaks everything
            if(this.name == "PackShit") {
                song.forceTrim  = true;
            }
            newSongs.push(song);
            debug("  [I] " + song.name, ": '" + song.title + "' added to songs");
        } else {
            debug("  WARNING!", "songs.xml: <song> element", i + 1, 
                "- no song '" + el.attributes[0].value + "' found");
        }
    }
    for(var i = 0; i < this.songs.length; i++) {
        if(newSongs.indexOf(this.songs[i]) == -1) {
            debug("  WARNING!", "We have a file for", song.name, "but no information for it");
        }
    }
    this.songs = newSongs;
}

Respack.prototype.parseInfoFile = function(text) {
    debug(" - Parsing infoFile");
    
    var oParser = new DOMParser();
    var oDOM = oParser.parseFromString(text, "text/xml");
    var info = oDOM.documentElement;
    if(info.nodeName !== "info"){
        console.log("info.xml error, corrupt file?")
        return;
    }
    
    // self reference strings to avoid changing strings twice in future
    this.name = info.getTag("name", this.name);
    this.author = info.getTag("author", this.author);
    this.description = info.getTag("description", this.description);
    this.link = info.getTag("link", this.link);
}

Respack.prototype.parseImageFile = function(text) {
    debug(" - Parsing imagefile");
    
    var oParser = new DOMParser();
    var oDOM = oParser.parseFromString(text, "text/xml");
    if(oDOM.documentElement.nodeName !== "images"){
        console.log("images.xml error, corrupt file?")
        return;
    }
    
    var newImages = [];
    // not in mobile safari
    // var imagesXML = oDOM.documentElement.children;
    var el = oDOM.documentElement.firstElementChild;
    for(; el; el = el.nextElementSibling) {
        var image = this.getImage(el.attributes[0].value);
        if(image) {
            image.fullname = el.getTag("fullname");
            if(!image.fullname) {
                debug("  WARNING!", image.name, "has no full name!");
            }
            image.source = el.getTag("source");
            // self reference strings to avoid changing strings twice in future
            image.align = el.getTag("align", image.align);
            var frameDur = el.getTag("frameDuration");
            if(frameDur) {
                image.frameDurations = []
                var strSplit = frameDur.split(",");
                for(var j = 0; j < strSplit.length; j++) {
                    image.frameDurations.push(parseInt(strSplit[j]));
                }
                while (image.frameDurations.length < image.bitmaps.length) {
                    image.frameDurations.push(image.frameDurations[image.frameDurations.length - 1]);
                }
                debug("Frame durations:", image.frameDurations);
            }
            debug("  [I] " + image.name, ":", image.fullname, "added to images");
            if (image.bitmap || image.bitmaps) {
                newImages.push(image);
            }
            else {
                debug("  WARNING!!", "Image", image.name, "has no bitmap nor animation frames!");
            }
        } else {
            debug("  WARNING!", "images.xml: <image> element", 
                i + 1, "- no image '" + el.attributes[0].value + "' found");
        }
    }
    for(var i = 0; i < this.images.length; i++) {
        var image = this.images[i];
        // Add all images with no info
        if(newImages.indexOf(image) == -1) {
            newImages.push(image);
        }
    }
    this.images = newImages;
}

Respack.prototype.containsSong = function(name) {
    return this.getSong(name) !== null;
}

Respack.prototype.containsImage = function(name) {
    return this.getImage(name) !== null;
}

Respack.prototype.getSong = function(name) {
    for(var i = 0; i < this.songs.length; i++) {
        if (name == this.songs[i].name) {
            return this.songs[i];
        }
    }
    return null;
}

Respack.prototype.getImage = function(name) {
    for(var i = 0; i < this.images.length; i++) {
        if (name == this.images[i].name) {
            return this.images[i];
        }
    }
    return null;
}

Respack.prototype.parseSongQueue = function() {
    var that = this;
    var songFile = this.songQueue.shift();
    var name = songFile.name.replace(this.audioExtensions, "");
    
    debug("parsing song: " + name);
    if (this.containsSong(name)) {
        var oldSong = this.getSong(name);
        debug("WARNING: Song", name, "already exists! Conflict with", name, "and", oldSong.name);
    } else {
        var newSong = {"name":name,
                       "title":null,
                       "rhythm":null,
                       "source":null,
                       //"crc":this.quickCRC(file), TODO
                       "sound":null,
                       "enabled":true,
                       "filename":songFile.name};
        songFile.getBlob("audio/mpeg3", function(sound) {
            // Because blobs are crap
            var fr = new FileReader();
            fr.onload = function() {
                newSong.sound = this.result;
                that.filesLoaded++;
                that.updateProgress();
                that.tryFinish();
            };
            fr.readAsArrayBuffer(sound);
        });
        this.songs.push(newSong);
    }
}

Respack.prototype.parseImageQueue = function() {
    var imgFile = this.imageQueue.shift();
    var name = imgFile.name.replace(this.imageExtensions, "");
    
    if (match = name.match(new RegExp("^(.*)_(\\d+)$"))) {
        var anim = this.getImage(match[1])
        if(!anim) { // make a fresh one
            anim = {"name":match[1],
                    "fullname":match[1],
                    "align":"center",
                    //"crc":this.quickCRC(imgFile),
                    "bitmaps":[],
                    "frameDurations":[33],
                    "source":null,
                    "enabled":true,
                    "animated":true};
            this.images.push(anim);
        }
        this.imageLoadStart(imgFile, anim);
    } else if (!this.containsImage(name)) {
        var img = {"name":name,
                "fullname":name,
                "bitmap":null,
                "align":"center",
                //"crc":this.quickCRC(imgFile),
                "source":null,
                "enabled":true,
                "filename":imgFile.name,
                "animated":false};
        this.images.push(img);
        this.imageLoadStart(imgFile, img);
    } else {
        existing = this.getImage(name);
        debug("WARNING: Image", name, "already exists! Conflict with", imgFile.name, "and", existing.name);
    }
}

Respack.prototype.imageLoadStart = function(imgFile, imageObj) {
    var that = this;
    var extension = imgFile.name.split('.').pop().toLowerCase();
    var mime;
    switch(extension) {
        case "png":
            mime = "image/png";
            break;
        case "gif":
            mime = "image/gif";
            break;
        case "jpg":
        case "jpeg":
            mime = "image/jpeg";
            break;
        default:
            mime = "application/octet-stream";
    }
    imgFile.getData64URI(mime, function(image) {
        that.imageLoadComplete(image, imageObj);
    });
}

Respack.prototype.imageLoadComplete = function(imageBmp, imageObj) {
    newImg = new Image();
    newImg.src = imageBmp;
    if (imageObj.animated) {
        imageObj.bitmaps.push(newImg);
    } else {
        imageObj.bitmap = newImg;
        debug("parsing image:", imageObj.name);
    }
    this.filesLoaded++;
    this.updateProgress();
    this.tryFinish();
}

Respack.prototype.tryFinish = function() {
    if (this.imageQueue.length > 0) {
        this.parseImageQueue();
    } else if(this.songQueue.length > 0) {
        this.parseSongQueue();
    } else {
        debug("Finished parsing images/songs, parsing xml files...");
        this.parseXML();
    }
}