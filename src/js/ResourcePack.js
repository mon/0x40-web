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

 (function(window, document) {
"use strict";

var debugConsole = false;
function debug() {
    if(debugConsole) {
        console.log.apply(window.console, arguments);
    }
}

function Respack() {
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

    this._songXMLPromise = null;
    this._imageXMLPromise = null;
    this._infoXMLPromise = null;

    this.totalFiles = -1;

    // For zip parsing progress events
    this.progressCallback = null;
    this.filesToLoad = 0;
    this.filesLoaded = 0;
    this.loadedFromURL = false;
}

Respack.prototype.audioExtensions = new RegExp("\\.(mp3|ogg)$", "i");
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
};

Respack.prototype.loadFromURL = function(url, progress) {
    this.loadedFromURL = true;
    if(progress) {
        this.progressCallback = progress;
    }

    return this.getBlob(url)
    .then(response => {
        return this.loadFromBlob(response);
    });
};

Respack.prototype.getBlob = function(url, progress) {
    if(progress) {
        this.progressCallback = progress;
    }
    return new Promise ((resolve, reject) => {
        var req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.responseType = 'blob';
        req.onload = () => {
            if(req.status == 200) {
                resolve(req.response);
            } else {
                reject(Error(req.status + ": Could not fetch respack at " + url));
            }
        };
        req.onerror = function() {
            reject(Error(req.status + ": Could not fetch respack at " + url));
        };
        req.onprogress = event => {
            if (event.lengthComputable) {
                this.size = event.total;
                this.downloaded = event.loaded;
                var percent = event.loaded / event.total;
                if(this.progressCallback) {
                    this.progressCallback(percent / 2, this); // because of processing too
                }
            }
        };
        req.send();
    }).catch(error => {
        // Infinitely more user friendly than the error Same Origin gives
        if(error.code == 1012) {
            throw Error("Respack at URL " + url + " is restricted. Check CORS.");
        } else {
            throw error;
        }
    });
}

Respack.prototype.loadFromBlob = function(blob, progress) {
    if(progress) {
        this.progressCallback = progress;
    }
    return new Promise((resolve, reject) => {
        this.size = blob.size;
        var file = new zip.fs.FS();
        file.importBlob(blob,
            () => {
                resolve(file);
            },
            error => {   // failure
                reject(Error("Respack error:", error.toString()));
            }
        );
    }).then(zip => {
        return this.parseZip(zip);
    }).then(() => {
        return this;
    });;
};

Respack.prototype.parseZip = function(zip) {
    var entries = zip.entries;

    this.totalFiles = 0;
    // Progress events
    this.filesToLoad = 0;
    this.filesLoaded = 0;

    // Get everything started
    for(var i = 0; i < entries.length; i++) {
        if(!entries[i].directory && entries[i].name) {
            this.totalFiles++;
            this.parseFile(entries[i]);
        }
    }

    return this.parseSongQueue()
    .then(() => {
        return this.parseImageQueue();
    }).then(() => {
        return this.parseXML();
    }).then(() => {
        // Cleanup
        this._songXMLPromise = null;
        this._imageXMLPromise = null;
        this._infoXMLPromise = null;
        console.log("Loaded", this.name, "successfully with", this.songs.length,
                    "songs and", this.images.length, "images.");
    });
};

Respack.prototype.parseFile = function(file) {
    var name = file.name;
    if (name.match(this.audioExtensions)) {
        this.songQueue.push(this.parseSong(file));
        this.filesToLoad++;
    } else if (name.match(this.imageExtensions)) {
        this.imageQueue.push(this.parseImage(file));
        this.filesToLoad++;
    }
    else {
        switch(name.toLowerCase()) {
            case "songs.xml":
                this._songXMLPromise = this.loadXML(file);
                break;
            case "images.xml":
                this._imageXMLPromise = this.loadXML(file);
                break;
            case "info.xml":
                this._infoXMLPromise = this.loadXML(file);
                break;
            default:
        }
    }
};

Respack.prototype.parseSong = function(file) {
    var name = file.name.replace(this.audioExtensions, "");
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
                       "filename":file.name,
                       "charsPerBeat": null};
        var extension = file.name.split('.').pop().toLowerCase();
        var mime = "";
        switch(extension) {
            case "mp3":
                mime = "audio/mpeg3";
                break;
            case "ogg":
                mime = "audio/ogg";
                break;
            default:
                mime = "application/octet-stream";
        }
        this.songs.push(newSong);
        return new Promise((resolve, reject) => {
            file.getBlob(mime, sound => {
                resolve(sound);
            });
        }).then(blob => {
            return new Promise((resolve, reject) => {
                // Because blobs are crap
                var fr = new FileReader();
                fr.onload = () => {
                    resolve(fr.result);
                };
                fr.readAsArrayBuffer(blob);
            });
        }).then(sound => {
            newSong.sound = sound;
            this.filesLoaded++;
            this.updateProgress();
        });
    }
};

Respack.prototype.parseSongQueue = function() {
    return this.songQueue.reduce((sequence, songPromise) => {
        return sequence.then(() => {
            // Maintain order
            return songPromise;
        });
    }, Promise.resolve());
}

Respack.prototype.parseImage = function(file) {
    var match;
    var name = file.name.replace(this.imageExtensions, "");
    var img;

    // Animation
    if((match = name.match(new RegExp("^(.*)_(\\d+)$")))) {
        var img = this.getImage(match[1]);
        if(!img) { // make a fresh one
            img = {"name":match[1],
                    "fullname":match[1],
                    "align":"center",
                    //"crc":this.quickCRC(file),
                    "bitmaps":[],
                    "frameDurations":[33],
                    "source":null,
                    "enabled":true,
                    "animated":true,
                    "beatsPerAnim": null};
            this.images.push(img);
        }
    // Normal image
    } else if (!this.containsImage(name)) {
        var img = {"name":name,
                "fullname":name,
                "bitmap":null,
                "align":"center",
                //"crc":this.quickCRC(file),
                "source":null,
                "enabled":true,
                "filename":file.name,
                "animated":false};
        this.images.push(img);
    } else {
        var existing = this.getImage(name);
        debug("WARNING: Image", name, "already exists! Conflict with", file.name, "and", existing.name);
        return;
    }
    
    return this.loadImage(file, img);
};

Respack.prototype.loadImage = function(imgFile, imageObj) {
    var extension = imgFile.name.split('.').pop().toLowerCase();
    var mime = "";
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
    return new Promise((resolve, reject) => {
        imgFile.getData64URI(mime, resolve);
    }).then(bitmap => {
        this.filesLoaded++;
        this.updateProgress();
        return {bitmap: bitmap, img: imageObj};
    });
};

Respack.prototype.parseImageQueue = function() {
    return this.imageQueue.reduce((sequence, imagePromise) => {
        return sequence.then(() => {
            // Maintain order
            return imagePromise;
        }).then(response => {
            var newImg = new Image();
            newImg.src = response.bitmap;
            if (response.img.animated) {
                response.img.bitmaps.push(newImg);
            } else {
                response.img.bitmap = newImg;
            }
        });
    }, Promise.resolve());
}

Respack.prototype.loadXML = function(file) {
    return new Promise((resolve, reject) => {
        file.getText(text => {
            //XML parser will complain about a bare '&', but some respacks use &amp
            text = text.replace(/&amp;/g, '&');
            text = text.replace(/&/g, '&amp;');
            resolve(text);
        });
    });
}

Respack.prototype.parseXML = function() {
    var p = Promise.resolve();
    // info xml?
    if(this._infoXMLPromise) {
        p = p.then(() => {
            return this._infoXMLPromise;
        }).then(text => {
            this.parseInfoFile(text);
        });
    }
    // song xml and songs exist?
    if (this.songs.length > 0) {
        if(this._songXMLPromise) {
            p = p.then(() => {
                return this._songXMLPromise;
            }).then(text => {
                this.parseSongFile(text);
            });
        } else {
            console.log("!!!", "Got songs but no songs.xml!");
        }
    }
    // images xml and images exist?
    if (this.images.length > 0 && this._imageXMLPromise) {
        p = p.then(() => {
            return this._imageXMLPromise;
        }).then(text => {
            this.parseImageFile(text);
        });
    }
    return p;
};

// Save some chars
Element.prototype.getTag = function(tag, def) {
    var t = this.getElementsByTagName(tag)[0];
    return t ? t.textContent : (def ? def : null);
};

Respack.prototype.parseSongFile = function(text) {
    debug(" - Parsing songFile");

    var oParser = new DOMParser();
    var oDOM = oParser.parseFromString(text, "text/xml");
    if(oDOM.documentElement.nodeName !== "songs"){
        console.log("songs.xml error, corrupt file?");
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
            song.buildupName = el.getTag("buildup");
            if(song.buildupName) {
                debug("  Finding a buildup '" + song.buildupName + "' for ", song.name);
                var build = this.getSong(song.buildupName);
                if(build) {
                    song.buildup = build.sound;
                    song.buildupPlayed = false;
                    // get rid of the junk
                    this.songs.splice(this.songs.indexOf(build), 1);
                } else {
                    debug("  WARNING!", "Didn't find a buildup '" + song.buildupName + "'!");
                }
            }

            song.buildupRhythm = el.getTag("buildupRhythm");
            song.independentBuild = el.getTag("independentBuild");
            song.source = el.getTag("source");
            song.charsPerBeat = parseFloat(el.getTag("charsPerBeat"));

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
            debug("  WARNING!", "We have a file for", this.songs[i].name, "but no information for it");
        }
    }
    this.songs = newSongs;
};

Respack.prototype.parseInfoFile = function(text) {
    debug(" - Parsing infoFile");

    var oParser = new DOMParser();
    var oDOM = oParser.parseFromString(text, "text/xml");
    var info = oDOM.documentElement;
    if(info.nodeName !== "info"){
        console.log("info.xml error, corrupt file?");
        return;
    }

    // self reference strings to avoid changing strings twice in future
    this.name = info.getTag("name", this.name);
    this.author = info.getTag("author", this.author);
    this.description = info.getTag("description", this.description);
    this.link = info.getTag("link", this.link);
};

Respack.prototype.parseImageFile = function(text) {
    debug(" - Parsing imagefile");

    var oParser = new DOMParser();
    var oDOM = oParser.parseFromString(text, "text/xml");
    if(oDOM.documentElement.nodeName !== "images"){
        console.log("images.xml error, corrupt file?");
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
            // self reference defaults to avoid changing strings twice in future
            image.align = el.getTag("align", image.align);
            image.beatsPerAnim = parseFloat(el.getTag("beatsPerAnim"));
            image.syncOffset = parseFloat(el.getTag("syncOffset"));
            var frameDur = el.getTag("frameDuration");
            if(frameDur) {
                image.frameDurations = [];
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
    newImages.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    this.images = newImages;
};

Respack.prototype.containsSong = function(name) {
    return this.getSong(name) !== null;
};

Respack.prototype.containsImage = function(name) {
    return this.getImage(name) !== null;
};

Respack.prototype.getSong = function(name) {
    for(var i = 0; i < this.songs.length; i++) {
        if (name == this.songs[i].name) {
            return this.songs[i];
        }
    }
    return null;
};

Respack.prototype.getImage = function(name) {
    for(var i = 0; i < this.images.length; i++) {
        if (name == this.images[i].name) {
            return this.images[i];
        }
    }
    return null;
};

window.Respack = Respack;

})(window, document);