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

const debugConsole = false;
function debug() {
    if(debugConsole) {
        console.log.apply(window.console, arguments);
    }
}

const audioExtensions = new RegExp("\\.(mp3|ogg|wav)$", "i");
const imageExtensions = new RegExp("\\.(png|gif|jpg|jpeg)$", "i");
const animRegex = new RegExp("(.*?)_\\d+$");

class Respack {
    constructor() {
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

        this._xmlQueue = [];

        this.totalFiles = -1;

        // For zip parsing progress events
        this.progressCallback = null;
        this.filesToLoad = 0;
        this.filesLoaded = 0;
        this.loadedFromURL = false;
    }

    updateProgress(override) {
        if(this.progressCallback) {
            let percent = this.filesLoaded / this.filesToLoad;
            if(this.loadedFromURL) {
                percent = (percent / 2) + 0.5;
            }
            this.progressCallback(typeof override === "number" ? override : percent, this);
        }
    }

    loadFromURL(url, progress) {
        this.loadedFromURL = true;
        if(progress) {
            this.progressCallback = progress;
        }

        return this.getBlob(url)
        .then(response => {
            return this.loadFromBlob(response);
        });
    }

    getBlob(url, progress) {
        if(progress) {
            this.progressCallback = progress;
        }
        return new Promise ((resolve, reject) => {
            let req = new XMLHttpRequest();
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
                    let percent = event.loaded / event.total;
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

    loadFromBlob(blob, progress) {
        if(progress) {
            this.progressCallback = progress;
        }
        // We don't get progress events for loading the zip, set 0 progress
        this.updateProgress(this.loadedFromURL ? 0.5 : 0);
        return new Promise((resolve, reject) => {
            this.size = blob.size;
            let file = new zip.fs.FS();
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
        });
    }

    parseZip(zip) {
        let entries = zip.entries;

        this.totalFiles = 0;
        // Progress events
        this.filesToLoad = 0;
        this.filesLoaded = 0;

        // Get everything started
        for(let i = 0; i < entries.length; i++) {
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
            this._xmlQueue = [];
            console.log("Loaded", this.name, "successfully with", this.songs.length,
                        "songs and", this.images.length, "images.");
        });
    }

    parseFile(file) {
        let name = file.name;
        if (name.match(audioExtensions)) {
            this.songQueue.push(this.parseSong(file));
            this.filesToLoad++;
        } else if (name.match(imageExtensions)) {
            this.imageQueue.push(this.parseImage(file));
            this.filesToLoad++;
        } else if(name.toLowerCase().endsWith(".xml")){
            this._xmlQueue.push(this.loadXML(file));
        }
    }

    parseSong(file) {
        let name = file.name.replace(audioExtensions, "");
        debug("parsing song: " + name);
        if (this.containsSong(name)) {
            let oldSong = this.getSong(name);
            debug("WARNING: Song", name, "already exists! Conflict with", name, "and", oldSong.name);
        } else {
            let newSong = {"name":name,
                           "title":null,
                           "rhythm":null,
                           "source":null,
                           //"crc":this.quickCRC(file), TODO
                           "sound":null,
                           "enabled":true,
                           "filename":file.name,
                           "charsPerBeat": null};
            let extension = file.name.split('.').pop().toLowerCase();
            let mime = "";
            switch(extension) {
                case "mp3":
                    mime = "audio/mpeg3";
                    break;
                case "ogg":
                    mime = "audio/ogg";
                    break;
                case "wav":
                    mime = "audio/wav";
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
                    let fr = new FileReader();
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
    }

    parseSongQueue() {
        return this.songQueue.reduce((sequence, songPromise) => {
            return sequence.then(() => {
                // Maintain order
                return songPromise;
            });
        }, Promise.resolve());
    }

    parseImage(file) {
        let match;
        let name = file.name.replace(imageExtensions, "");
        let img;

        // Animation
        if((match = name.match(new RegExp("^(.*)_(\\d+)$")))) {
            img = this.getImage(match[1]);
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
            img = {"name":name,
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
            let existing = this.getImage(name);
            console.log("WARNING: Image", name, "already exists! Conflict with", file.name, "and", existing.name);
            return;
        }

        return this.loadImage(file, img);
    }

    loadImage(imgFile, imageObj) {
        let extension = imgFile.name.split('.').pop().toLowerCase();
        let mime = "";
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
    }

    parseImageQueue() {
        return this.imageQueue.reduce((sequence, imagePromise) => {
            return sequence.then(() => {
                // Maintain order
                return imagePromise;
            }).then(response => {
                // Don't crash if the respack had duplicate images
                if(!response)
                    return;
                let newImg = new Image();
                newImg.src = response.bitmap;
                if (response.img.animated) {
                    response.img.bitmaps.push(newImg);
                } else {
                    response.img.bitmap = newImg;
                }
            });
        }, Promise.resolve());
    }

    loadXML(file) {
        return new Promise((resolve, reject) => {
            file.getText(text => {
                //XML parser will complain about a bare '&', but some respacks use &amp
                text = text.replace(/&amp;/g, '&');
                text = text.replace(/&/g, '&amp;');
                let parser = new DOMParser();
                let dom = parser.parseFromString(text, "text/xml");
                resolve(dom);
            });
        });
    }

    parseXML() {
        for(let i = 0; i < this._xmlQueue.length; i++) {
            this._xmlQueue[i] = this._xmlQueue[i].then(dom => {
                switch(dom.documentElement.nodeName) {
                    case "songs":
                        if(this.songs.length > 0)
                            this.parseSongFile(dom);
                        break;
                    case "images":
                        if(this.images.length > 0)
                            this.parseImageFile(dom);
                        break;
                    case "info":
                        this.parseInfoFile(dom);
                        break;
                    default:
                        console.log("XML found with no songs, images or info");
                        break;
                }
            });
        }
        return Promise.all(this._xmlQueue);
    }

    parseSongFile(dom) {
        debug(" - Parsing songFile");

        let newSongs = [];
        let el = dom.documentElement.firstElementChild;
        for(; el; el = el.nextElementSibling) {
            let song = this.getSong(el.attributes[0].value);
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

                song.buildupName = el.getTag("buildup");
                if(song.buildupName) {
                    debug("  Finding a buildup '" + song.buildupName + "' for ", song.name);
                    let build = this.getSong(song.buildupName);
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
                debug("  WARNING!", "songs.xml: <song> element",
                    + el.attributes[0].value + "- no song found");
            }
        }
        for(let i = 0; i < this.songs.length; i++) {
            if(newSongs.indexOf(this.songs[i]) == -1) {
                debug("  WARNING!", "We have a file for", this.songs[i].name, "but no information for it");
            }
        }
        this.songs = newSongs;
    }

    parseInfoFile(dom) {
        debug(" - Parsing infoFile");

        let info = dom.documentElement;

        // self reference strings to avoid changing strings twice in future
        this.name = info.getTag("name", this.name);
        this.author = info.getTag("author", this.author);
        this.description = info.getTag("description", this.description);
        this.link = info.getTag("link", this.link);
    }

    parseImageFile(dom) {
        debug(" - Parsing imagefile");

        let newImages = [];
        let el = dom.documentElement.firstElementChild;
        for(; el; el = el.nextElementSibling) {
            let image = this.getImage(el.attributes[0].value);
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
                let frameDur = el.getTag("frameDuration");
                if(frameDur) {
                    image.frameDurations = [];
                    let strSplit = frameDur.split(",");
                    for(let j = 0; j < strSplit.length; j++) {
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
                debug("  WARNING!", "images.xml: no image '" + el.attributes[0].value + "' found");
            }
        }
        for(let i = 0; i < this.images.length; i++) {
            let image = this.images[i];
            // Add all images with no info
            if(newImages.indexOf(image) == -1) {
                newImages.push(image);
            }
        }
        newImages.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });
        this.images = newImages;
    }

    containsSong(name) {
        return this.getSong(name) !== null;
    }

    containsImage(name) {
        return this.getImage(name) !== null;
    }

    getSong(name) {
        for(let i = 0; i < this.songs.length; i++) {
            if (name == this.songs[i].name) {
                return this.songs[i];
            }
        }
        return null;
    }

    getImage(name) {
        for(let i = 0; i < this.images.length; i++) {
            if (name == this.images[i].name) {
                return this.images[i];
            }
        }
        return null;
    }
}

window.Respack = Respack;

// Save some chars
Element.prototype.getTag = function(tag, def) {
    let t = this.getElementsByTagName(tag)[0];
    return t ? t.textContent : (def ? def : null);
};

})(window, document);