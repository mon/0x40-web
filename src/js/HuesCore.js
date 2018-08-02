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

class HuesCore {
    constructor(defaults) {
        this.eventListeners = {
            /* callback loaded()
             *
             * When everything has completely loaded and we're ready to go
             */
            loaded : [],

            /* callback time(seconds)
             *
             * When the song time is updated - negative for buildup
             * Returns a floating point number denoting seconds
             */
            time : [],

            /* callback blurUpdate(xPercent, yPercent)
             *
             * The current blur amounts, in percent of full blur
             */
            blurupdate : [],

            /* callback newsong(song)
             *
             * Called on song change, whether user triggered or autosong.
             * Song object is passed.
             */
            newsong : [],

            /* callback newimage(image)
             *
             * Called on image change, whether user triggered or FULL AUTO mode.
             * Image object is passed.
             */
            newimage : [],

            /* callback newcolour(colour, isFade)
             *
             * Called on colour change.
             * colour: colour object.
             * isFade: if the colour is fading from the previous value
             */
            newcolour : [],

            /* callback newmode(mode)
             *
             * Called on mode change.
             * Mode is passed as a boolean.
             */
            newmode : [],

            /* callback beat(beatString, beatIndex)
             *
             * Called on every new beat.
             * beatString is a 256 char long array of current and upcoming beat chars
             * beatIndex is the beat index. Negative during buildups
             */
            beat : [],

            /* callback invert(isInverted)
             *
             * Called whenever the invert state changes.
             * Invert state is passed as a boolean.
             */
            invert : [],

            /* callback frame()
             *
             * Called on each new frame, at the end of all other frame processing
             */
            frame : [],

            /* callback songstarted(song)
             *
             * Called when the song actually begins to play, not just when the
             * new song processing begins. Song object passed.
             */
            songstarted : [],

            /* callback settingsupdated()
             *
             * Called when settings are updated and should be re-read from the settings object
             */
            settingsupdated : []
        };

        // Bunch-o-initialisers
        this.version = 33;
        this.versionStr = (this.version/10).toFixed(1);
        this.versionHex = this.version.toString(16);
        this.beatIndex = 0;

        // How long a beat lasts for in each section
        this.buildLength = -1;
        this.loopLength = -1;

        this.currentSong = null;
        this.currentImage = null;
        this.songIndex = -1;
        this.imageIndex = -1;
        this.lastSongArray = [];
        this.lastImageArray = [];

        this.colourIndex = 0x3f;
        this.colours = HuesCore.oldColours;

        this.invert = false;
        this.loopCount = 0;
        this.doBuildup = true;
        this.userInterface = null;
        this.uiArray = [];

        this.settings = new HuesSettings(defaults);
        zip.workerScriptsPath = this.settings.workersPath;

        // What's our root element?
        this.root = null;
        if(!this.settings.root) {
            this.root = document.body;
        } else if(typeof this.settings.root === "string") {
            if(this.settings.root && document.getElementById(this.settings.root)) {
                this.root = document.getElementById(this.settings.root);
            } else {
                this.root = document.body;
            }
        } else { // been given an element
            this.root = this.settings.root;
        }
        this.root.classList.add("hues-root");
        // Special case for full page Hues
        if(this.root === document.body) {
            document.documentElement.className = "hues-root";
        }
        // Yes, we do indeed have Javascript
        this.root.innerHTML = "";

        this.makePreloader(this.root);

        window.onerror = (msg, url, line, col, error) => {
            this.error(msg);
            // Get more info in console
            return false;
        };

        this.window = new HuesWindow(this.root, this.settings);

        console.log("0x40 Hues v" + this.versionStr + " - start your engines!");

        this.resourceManager = new Resources(this, this.window);
        this.editor = new HuesEditor(this, this.window);
        this.settings.initUI(this.window);
        populateHuesInfo(this.versionStr, this.window, this.settings);

        this.window.selectTab(this.settings.firstWindow, true);

        let ui = document.createElement("div");
        ui.className = "hues-ui";
        this.root.appendChild(ui);
        this.uiArray.push(new RetroUI(ui), new WeedUI(ui), new ModernUI(ui),
                          new XmasUI(ui), new HalloweenUI(ui), new MinimalUI(ui));

        this.autoSong = this.settings.autoSong;

        this.visualiser = document.createElement("canvas");
        this.visualiser.className = "hues-visualiser";
        this.visualiser.height = "64";
        this.vCtx = this.visualiser.getContext("2d");

        this.soundManager = new SoundManager(this);

        this.soundManager.init().then(() => {
            if(!this.soundManager.locked && this.settings.skipPreloader == "on") {
                return null;
            } else {
                return this.resourceManager.getSizes(this.settings.respacks);
            }
        }).then( sizes => {
            if(sizes === null) {
                return;
            }

            let size = sizes.reduce( (prev, curr) => {
                return typeof curr === 'number' ? prev + curr : null;
            }, 0);
            if(typeof size === 'number') {
                size = size.toFixed(1);
            } else {
                size = '<abbr title="Content-Length header not present for respack URLs">???</abbr>';
            }

            let warning = size + "MB of music/images.<br />" +
                "Flashing lights.<br />" +
                "<b>Tap or click to start</b>";

            if(!this.soundManager.locked) {
                warning += "<br /><span>Skip this screen from Options</span>";
            }
            this.warning(warning);
            // Even if not locked, this steals clicks which is useful here
            return this.soundManager.unlock();
        }).then(() => {
            this.clearMessage();
            setInterval(this.loopCheck.bind(this), 1000);
            this.renderer = new HuesCanvas(this.root, this.soundManager, this);
            // Now all our objects are instantiated, we fire the updated settings
            this.settings.addEventListener("updated", this.settingsUpdated.bind(this));
            this.settingsUpdated();
            this.setColour(this.colourIndex);
            this.animationLoop();

            if(this.settings.load) {
                return this.resourceManager.addAll(this.settings.respacks, progress => {
                    this.preloader.style.backgroundPosition = (100 - progress*100) + "% 0%";
                    let scale = Math.floor(progress * this.settings.preloadMax);
                    let padding = this.settings.preloadMax.toString(this.settings.preloadBase).length;
                    this.preloadMsg.textContent = this.settings.preloadPrefix +
                                                  (Array(padding).join("0") +
                                                  scale.toString(this.settings.preloadBase)).slice(-padding);
                });
            } else {
                this.preloader.style.display = "none";
                return;
            }
        }).then(() => {
            this.preloader.classList.add("hues-preloader--loaded");
            this.callEventListeners("loaded");
            if(this.settings.firstImage) {
                this.setImageByName(this.settings.firstImage);
            } else {
                this.setImage(0);
            }
            if(this.settings.autoplay) {
                if(this.settings.firstSong) {
                    this.setSongByName(this.settings.firstSong);
                } else {
                    this.setSong(0);
                }
            }
        }).catch(error => { // Comment this out to get proper stack traces
            this.error(error);
        });

        if(!this.settings.disableKeyboard) {
            document.addEventListener("keydown", e => {
                e = e || window.event;
                if(e.defaultPrevented) {
                    return true;
                }
                // Ignore modifiers so we don't steal other events
                if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
                    return true;
                }
                // If we've focused a text input, let the input go through!
                if((e.target.tagName.toLowerCase() == "input" && e.target.type == "text") ||
                    e.target.contentEditable === "true") {
                    return true;
                }
                let key = e.keyCode || e.which;
                return this.keyHandler(key);
            });
        }
    }

    callEventListeners(ev) {
        let args = Array.prototype.slice.call(arguments, 1);
        this.eventListeners[ev].forEach(function(callback) {
            callback.apply(null, args);
        });
    }

    addEventListener(ev, callback) {
        ev = ev.toLowerCase();
        if (typeof(this.eventListeners[ev]) !== "undefined") {
            this.eventListeners[ev].push(callback);
        } else {
            throw Error("Unknown event: " + ev);
        }
    }

    removeEventListener(ev, callback) {
        ev = ev.toLowerCase();
        if (typeof(this.eventListeners[ev]) !== "undefined") {
            this.eventListeners[ev] = this.eventListeners[ev].filter(function(a) {
                return (a !== callback);
            });
        } else {
            throw Error("Unknown event: " + ev);
        }
    }

    makePreloader(root) {
        this.preloader = document.createElement("div");
        this.preloader.className = "hues-preloader";
        root.appendChild(this.preloader);

        if(this.settings.preloadTitle) {
            this.preloadTitle = document.createElement("div");
            this.preloadTitle.className = "hues-preloader__title";
            this.preloadTitle.textContent = this.settings.preloadTitle;
            this.preloader.appendChild(this.preloadTitle);
        }

        this.preloadMsg = document.createElement("div");
        this.preloadMsg.className = "hues-preloader__text";
        this.preloadMsg.textContent = "Initialising...";
        this.preloader.appendChild(this.preloadMsg);

        this.preloadSubMsg = document.createElement("div");
        this.preloadSubMsg.className = "hues-preloader__subtext";
        this.preloader.appendChild(this.preloadSubMsg);
    }

    resizeVisualiser() {
        this.soundManager.initVisualiser(this.visualiser.width/2);
    }

    updateVisualiser() {
        if(this.settings.visualiser != "on") {
            return;
        }

        let logArrays = this.soundManager.getVisualiserData();
        if(!logArrays) {
            return;
        }

        this.vCtx.clearRect(0, 0, this.vCtx.canvas.width, this.vCtx.canvas.height);

        let gradient=this.vCtx.createLinearGradient(0,64,0,0);
        if(this.invert) {
            gradient.addColorStop(1,"rgba(20,20,20,0.6)");
            gradient.addColorStop(0,"rgba(255,255,255,0.6)");
        } else {
            gradient.addColorStop(1,"rgba(255,255,255,0.6)");
            gradient.addColorStop(0,"rgba(20,20,20,0.6)");
        }
        this.vCtx.fillStyle = gradient;

        let barWidth = 2;
        let barHeight;
        let x = 0;
        for(let a = 0; a < logArrays.length; a++) {
            let vals = logArrays[a];
            for(let i = 0; i < vals.length; i++) {
                let index = 0;
                if(logArrays.length == 2 && a === 0) {
                    index = vals.length - i - 1;
                } else {
                    index = i;
                }
                barHeight = vals[index]/4;

                this.vCtx.fillRect(x,this.vCtx.canvas.height-barHeight,barWidth,barHeight);

                x += barWidth;
            }
        }
    }

    animationLoop() {
        requestAnimationFrame(this.animationLoop.bind(this));
        if(!this.soundManager.playing) {
            this.callEventListeners("frame");
            return;
        }
        this.updateVisualiser();
        let now = this.soundManager.currentTime;
        this.callEventListeners("time", this.soundManager.clampedTime);
        if(now >= 0 && this.doBuildup) {
            this.currentSong.buildupPlayed = true;
        }
        for(let beatTime = this.beatIndex * this.getBeatLength(); beatTime < now;
                beatTime = ++this.beatIndex * this.getBeatLength()) {
            let beat = this.getBeat(this.beatIndex);
            this.beater(beat);
        }
        this.callEventListeners("frame");
    }

    recalcBeatIndex(forcedNow) {
        let now = typeof forcedNow === "number" ? forcedNow : this.soundManager.currentTime;
        // getBeatLength isn't updated with the right beatIndex yet
        this.beatIndex = Math.floor(now / (now < 0 ? this.buildLength : this.loopLength));
        // beatIndex is NaN, abort
        if(this.beatIndex != this.beatIndex) {
            this.setInvert(false);
            return;
        }

        // We should sync up to how many inverts there are
        let build = this.currentSong.buildupRhythm;
        let rhythm = this.currentSong.rhythm;
        let mapSoFar;
        if(this.beatIndex < 0) {
            // Clamp to 0 in case we've juuust started
            mapSoFar = build.slice(0, Math.max(this.beatIndex + build.length, 0));
        } else {
            // If the rhythm has an odd number of inverts, don't reset because it
            // alternates on each loop anyway
            if((rhythm.match(/i|I/g)||[]).length % 2) {
                return;
            }
            mapSoFar = (build ? build : "") + rhythm.slice(0, this.beatIndex);
        }
        // If there's an odd amount of inverts thus far, invert our display
        let invertCount = (mapSoFar.match(/i|I/g)||[]).length;
        this.setInvert(invertCount % 2);
    }

    getBeatIndex() {
        if(!this.soundManager.playing) {
            return 0;
        } else if(this.beatIndex < 0) {
            return this.beatIndex;
        } else {
            return this.beatIndex % this.currentSong.rhythm.length;
        }
    }

    getSafeBeatIndex() {
        let index = this.getBeatIndex();
        if(index < 0) {
            return 0;
        } else {
            return index;
        }
    }

    blurUpdated(x, y) {
        this.callEventListeners("blurupdate", x, y);
    }

    nextSong() {
        let index = (this.songIndex + 1) % this.resourceManager.enabledSongs.length;
        this.setSong(index);
    }

    previousSong() {
        let index = ((this.songIndex - 1) + this.resourceManager.enabledSongs.length) % this.resourceManager.enabledSongs.length;
        this.setSong(index);
    }

    setSongByName(name) {
        let songs = this.resourceManager.enabledSongs;
        let bestSong = 0;
        let bestScore = 0;
        for(let i = 0; i < songs.length; i++) {
            let score = songs[i].title.score(name);
            if(score > bestScore) {
                bestScore = score;
                bestSong = i;
            }
        }
        return this.setSong(bestSong);
    }

    /* To set songs via reference instead of index - used in HuesEditor */
    setSongOject(song) {
        for(let i = 0; i < this.resourceManager.enabledSongs.length; i++) {
            if(this.resourceManager.enabledSongs[i] === song) {
                return this.setSong(i);
            }
        }
    }

    setSong(index, leaveArray) {
        if(this.currentSong == this.resourceManager.enabledSongs[index]) {
            return;
        }
        // When not randoming, clear this
        if(!leaveArray) {
            this.lastSongArray = [];
        }
        this.lastSongArray.push(index);
        this.songIndex = index;
        this.currentSong = this.resourceManager.enabledSongs[this.songIndex];
        if (this.currentSong === undefined) {
            this.currentSong = {"name":"None", "title":"None", "rhythm":".", "source":null, "crc":"none", "sound":null, "enabled":true, "filename":"none"};
        }
        console.log("Next song:", this.songIndex, this.currentSong);
        this.callEventListeners("newsong", this.currentSong);
        this.loopCount = 0;
        if (this.currentSong.buildup) {
            switch (this.settings.playBuildups) {
            case "off":
                this.currentSong.buildupPlayed = true;
                this.doBuildup = false;
                break;
            case "on":
                this.currentSong.buildupPlayed = false;
                this.doBuildup = true;
                break;
            case "once":
                this.doBuildup = !this.currentSong.buildupPlayed;
                break;
            }
        }
        this.setInvert(false);
        this.renderer.doInstantBlackout();
        return this.soundManager.playSong(this.currentSong, this.doBuildup)
        .then(() => {
            this.resetAudio();
            this.fillBuildup();
            this.callEventListeners("songstarted", this.currentSong);
        });
    }

    updateBeatLength() {
        this.loopLength = this.soundManager.loopLength / this.currentSong.rhythm.length;
        if(this.currentSong.buildup) {
            if (!this.currentSong.buildupRhythm) {
                this.currentSong.buildupRhythm = ".";
            }
            this.buildLength = this.soundManager.buildLength / this.currentSong.buildupRhythm.length;
        } else {
            this.buildLength = -1;
        }
    }

    getBeatLength() {
        if(this.beatIndex < 0) {
            return this.buildLength;
        } else {
            return this.loopLength;
        }
    }

    fillBuildup() {
        // update loop length for flash style filling
        this.updateBeatLength();
        if(this.currentSong.buildup) {
            if(this.currentSong.independentBuild) {
                console.log("New behaviour - separate build/loop lengths");
                // Do nothing
            } else {
                console.log("Flash behaviour - filling buildup");
                let buildBeats = Math.floor(this.soundManager.buildLength / this.loopLength);
                if(buildBeats < 1) {
                    buildBeats = 1;
                }
                while (this.currentSong.buildupRhythm.length < buildBeats) {
                    this.currentSong.buildupRhythm = this.currentSong.buildupRhythm + ".";
                }
                console.log("Buildup length:", buildBeats);
            }
        }
        // update with a buildup of possibly different length
        this.updateBeatLength();
        // If we're in the build or loop this will adjust
        // If we've lagged a bit, we'll miss the first beat. Rewind!
        this.recalcBeatIndex(this.doBuildup ? -this.soundManager.buildLength : 0);
    }

    randomSong() {
        let songCount = this.resourceManager.enabledSongs.length;
        let index=Math.floor((Math.random() * songCount));
        if (songCount > 1 && (index == this.songIndex || this.lastSongArray.indexOf(index) != -1)) {
            this.randomSong();
        } else {
            console.log("Randoming a song!");
            this.setSong(index, true);
            let noRepeat = Math.min(5, Math.floor(songCount / 2));
            while (this.lastSongArray.length > noRepeat && noRepeat >= 0) {
                this.lastSongArray.shift();
            }
        }
    }

    /* This is its own function because requestAnimationFrame is called very very
       rarely when the tab is backgrounded. As autoSong is often used to chill with
       music, it's important to keep checking the loop so songs don't go for too
       long. */
    loopCheck() {
        if(Math.floor(this.soundManager.currentTime / this.soundManager.loopLength) > this.loopCount) {
            this.onLoop();
        }
    }

    onLoop() {
        this.loopCount++;
        switch (this.settings.autoSong) {
        case "loop":
            console.log("Checking loops");
            if (this.loopCount >= this.settings.autoSongDelay) {
                this.doAutoSong();
            }
            break;
        case "time":
            console.log("Checking times");
            if (this.soundManager.loopLength * this.loopCount >= this.settings.autoSongDelay * 60) {
                this.doAutoSong();
            }
            break;
        }
    }

    doAutoSong() {
        let func = null;
        if(this.resourceManager.enabledSongs.length < 2) {
            return; // don't move if there's nothing to move to
        }
        if(this.settings.autoSongShuffle == "on") {
            func = this.randomSong;
        } else {
            func = this.nextSong;
        }
        if(this.settings.autoSongFadeout == "on") {
            this.soundManager.fadeOut(() => {
                func.call(this);
            });
        } else {
            func.call(this);
        }
    }

    songDataUpdated() {
        if (this.currentSong) {
            this.callEventListeners("newsong", this.currentSong);
            this.callEventListeners("newimage", this.currentImage);
        }
    }

    resetAudio() {
        this.beatIndex = 0;
        this.songDataUpdated();
        if(this.settings.visualiser == "on") {
            this.soundManager.initVisualiser(this.visualiser.width/2);
        }
    }

    randomImage() {
        if(this.settings.shuffleImages == "on") {
            let len = this.resourceManager.enabledImages.length;
            let index = Math.floor(Math.random() * len);
            if ((index == this.imageIndex || this.lastImageArray.indexOf(index) != -1) && len > 1) {
                this.randomImage();
            } else {
                this.setImage(index, true);
                this.lastImageArray.push(index);
                let cull = Math.min(20, Math.floor((len / 2)));
                while (this.lastImageArray.length > cull && cull >= 0) {
                    this.lastImageArray.shift();
                }
            }
        } else { // jk, not actually random
            let img=(this.imageIndex + 1) % this.resourceManager.enabledImages.length;
            this.setImage(img);
        }
    }

    setImage(index, leaveArray) {
        // If there are no images, this corrects NaN to 0
        this.imageIndex = index ? index : 0;
        let img=this.resourceManager.enabledImages[this.imageIndex];
        if (img == this.currentImage && img !== null) {
            return;
        }
        // When not randoming, clear this
        if(!leaveArray) {
            this.lastImageArray = [];
        }
        if (img) {
            this.currentImage = img;
        } else {
            this.currentImage = {"name":"None", "fullname":"None", "align":"center", "bitmap":null, "source":null, "enabled":true};
            this.imageIndex = -1;
            this.lastImageArray = [];
        }
        this.callEventListeners("newimage", this.currentImage);
    }

    setImageByName(name) {
        let images = this.resourceManager.enabledImages;
        for(let i = 0; i < images.length; i++) {
            if(images[i].name == name || images[i].fullname == name) {
                this.setImage(i);
                return;
            }
        }
        this.setImage(0); // fallback
    }

    nextImage() {
        this.setIsFullAuto(false);
        let img=(this.imageIndex + 1) % this.resourceManager.enabledImages.length;
        this.setImage(img);
    }

    previousImage() {
        this.setIsFullAuto(false);
        let img=((this.imageIndex - 1) + this.resourceManager.enabledImages.length) % this.resourceManager.enabledImages.length;
        this.setImage(img);
    }

    randomColourIndex() {
        let index=Math.floor((Math.random() * this.colours.length));
        if (index == this.colourIndex) {
            return this.randomColourIndex();
        }
        return index;
    }

    randomColour(isFade) {
        let index=this.randomColourIndex();
        this.setColour(index, isFade);
    }

    setColour(index, isFade) {
        this.colourIndex = index;
        let colour = this.colours[this.colourIndex];
        this.callEventListeners("newcolour", colour, isFade);
    }

    getBeat(index) {
        if(index < 0) {
            return this.currentSong.buildupRhythm[this.currentSong.buildupRhythm.length+index];
        } else {
            return this.currentSong.rhythm[index % this.currentSong.rhythm.length];
        }
    }

    beater(beat) {
        this.callEventListeners("beat", this.getBeatString(), this.getBeatIndex());
        switch(beat) {
            case 'X':
            case 'x':
                this.renderer.doYBlur();
                break;
            case 'O':
            case 'o':
                this.renderer.doXBlur();
                break;
            case ')':
                this.renderer.doTrippyX();
                break;
            case '(':
                this.renderer.doTrippyY();
                break;
            case '+':
                this.renderer.doXBlur();
                this.renderer.doBlackout();
                break;
            case '¤':
                this.renderer.doXBlur();
                this.renderer.doBlackout(true);
                break;
            case '|':
                this.renderer.doShortBlackout(this.getBeatLength());
                this.randomColour();
                break;
            case ':':
                this.randomColour();
                break;
            case '*':
                if(this.settings.fullAuto) {
                    this.randomImage();
                }
                break;
            case '=':
                if(this.settings.fullAuto) {
                    this.randomImage();
                }
                /* falls through */
            case '~':
                this.renderer.doColourFade(this.timeToNextBeat());
                this.randomColour(true);
                break;
            case 'S':
            case 's':
                this.renderer.doSlice(this.getBeatLength(), this.charsToNextBeat(), false, true);
                break;
            case 'V':
            case 'v':
                this.renderer.doSlice(this.getBeatLength(), this.charsToNextBeat(), true, false);
                break;
            case '@':
            case '#':
                this.renderer.doSlice(this.getBeatLength(), this.charsToNextBeat(), true, true);
                break;
            case 'I':
                if (this.settings.fullAuto) {
                    this.randomImage();
                }
                /* falls through */
            case 'i':
                this.toggleInvert();
                break;
            }
            if ([".", "+", "|", "¤"].indexOf(beat) == -1) {
                this.renderer.clearBlackout();
            }
            if([".", "+", "¤", ":", "*", "X", "O", "~", "=", "i", "I", "s", "v", "#"].indexOf(beat) == -1) {
                this.randomColour();
                if (this.settings.fullAuto) {
                    this.randomImage();
                }
        }
    }


    charsToNextBeat() {
        // case: fade in build, not in rhythm. Must max out fade timer.
        let maxSearch = this.currentSong.rhythm.length;
        if(this.beatIndex < 0) {
            maxSearch -= this.beatIndex;
        }
        let nextBeat;
        for (nextBeat = 1; nextBeat <= maxSearch; nextBeat++) {
            if (this.getBeat(nextBeat + this.beatIndex) != ".") {
                break;
            }
        }
        return nextBeat;
    }

    timeToNextBeat() {
        return (this.charsToNextBeat() * this.getBeatLength()) / this.soundManager.playbackRate;
    }

    getBeatString(length) {
        length = length ? length : 256;

        let beatString = "";
        let song = this.currentSong;
        if (song) {
            if(this.beatIndex < 0) {
                beatString = song.buildupRhythm.slice(
                        song.buildupRhythm.length + this.beatIndex);
            } else {
                beatString = song.rhythm.slice(this.beatIndex % song.rhythm.length);
            }
            while (beatString.length < length) {
                beatString += song.rhythm;
            }
        }

        return beatString;
    }

    setIsFullAuto(auto) {
        this.settings.fullAuto = auto;
        if (this.userInterface) {
            this.callEventListeners("newmode", this.settings.fullAuto);
        }
    }

    toggleFullAuto() {
        this.setIsFullAuto(!this.settings.fullAuto);
    }

    setInvert(invert) {
        this.invert = !!invert;
        this.callEventListeners("invert", invert);
    }

    toggleInvert() {
        this.setInvert(!this.invert);
    }

    respackLoaded() {
        this.init();
    }

    changeUI(index) {
        if (index >= 0 && this.uiArray.length > index && this.userInterface != this.uiArray[index]) {
            this.hideLists();
            if(this.userInterface) {
                this.userInterface.disconnect();
            }
            this.userInterface = this.uiArray[index];
            this.userInterface.connectCore(this);
            this.callEventListeners("newmode", this.settings.fullAuto);
            this.callEventListeners("newsong", this.currentSong);
            this.callEventListeners("newimage", this.currentImage);
            this.callEventListeners("newcolour", this.colours[this.colourIndex], false);
            this.callEventListeners("beat", this.getBeatString(), this.getBeatIndex());
            this.callEventListeners("invert", this.invert);
        }
    }

    settingsUpdated() {
        this.callEventListeners("settingsupdated");
        switch (this.settings.currentUI) {
        case "retro":
            this.changeUI(0);
            break;
        case "v4.20":
            this.changeUI(1);
            break;
        case "modern":
            this.changeUI(2);
            break;
        case "xmas":
            this.changeUI(3);
            break;
        case "hlwn":
            this.changeUI(4);
            break;
        case "mini":
            this.changeUI(5);
            break;
        }
        switch (this.settings.colourSet) {
        case "normal":
            this.colours = HuesCore.oldColours;
            break;
        case "pastel":
            this.colours = HuesCore.pastelColours;
            break;
        case "v4.20":
            this.colours = HuesCore.weedColours;
            break;
        }
        switch (this.settings.blackoutUI) {
        case "off":
            this.userInterface.show();
            break;
        case "on":
            if(this.renderer.blackout) {
                this.userInterface.hide();
            }
            break;
        }
        switch (this.settings.visualiser) {
        case "off":
            this.visualiser.classList.add("hidden");
            break;
        case "on":
            this.visualiser.classList.remove("hidden");
            if(!this.soundManager.vReady) {
                this.soundManager.initVisualiser(this.visualiser.width/2);
            }
            break;
        }
        if (this.autoSong == "off" && this.settings.autoSong != "off") {
            console.log("Resetting loopCount since AutoSong was enabled");
            this.loopCount = 0;
        }
        this.autoSong = this.settings.autoSong;
    }

    enabledChanged() {
        this.resourceManager.rebuildEnabled();
    }

    hideLists() {
        this.resourceManager.hideLists();
    }

    toggleSongList() {
        this.window.hide();
        this.resourceManager.toggleSongList();
    }

    toggleImageList() {
        this.window.hide();
        this.resourceManager.toggleImageList();
    }

    openSongSource() {
        if (this.currentSong && this.currentSong.source) {
            window.open(this.currentSong.source,'_blank');
        }
    }

    openImageSource() {
        if (this.currentImage && this.currentImage.source) {
            window.open(this.currentImage.source,'_blank');
        }
    }

    keyHandler(key) {
        switch (key) {
        case 37: // LEFT
            this.previousImage();
            break;
        case 39: // RIGHT
            this.nextImage();
            break;
        case 38: // UP
            this.nextSong();
            break;
        case 40: // DOWN
            this.previousSong();
            break;
        case 70: // F
            this.toggleFullAuto();
            break;
        case 109: // NUMPAD_SUBTRACT
        case 189: // MINUS
        case 173: // MINUS, legacy
            this.soundManager.decreaseVolume();
            break;
        case 107: // NUMPAD_ADD
        case 187: // EQUAL
        case 61: // EQUAL, legacy
            this.soundManager.increaseVolume();
            break;
        case 66: // B
            this.soundManager.seek(-this.soundManager.buildLength);
            break;
        case 77: // M
            this.soundManager.toggleMute();
            break;
        case 72: // H
            this.userInterface.toggleHide();
            break;
        case 82: // R
            this.window.selectTab("RESOURCES");
            break;
        case 69: // E
            this.window.selectTab("EDITOR");
            break;
        case 79: // O
            this.window.selectTab("OPTIONS");
            break;
        case 73: // I
            this.window.selectTab("INFO");
            break;
        case 49: // NUMBER_1
            this.settings.set("currentUI", "retro");
            break;
        case 50: // NUMBER_2
            this.settings.set("currentUI", "v4.20");
            break;
        case 51: // NUMBER_3
            this.settings.set("currentUI", "modern");
            break;
        case 52: // NUMBER_4
            this.settings.set("currentUI", "xmas");
            break;
        case 53: // NUMBER_5
            this.settings.set("currentUI", "hlwn");
            break;
        case 54: // NUMBER_6
            this.settings.set("currentUI", "mini");
            break;
        case 67: // C
            this.toggleImageList();
            break;
        case 83: // S
            this.toggleSongList();
            break;
        case 87: // W
            this.window.toggle();
            break;
        case 78: // N
            this.randomSong();
            break;
        default:
            return true;
        }
        return false;
    }

    error(message) {
        console.log(message);
        this.preloadSubMsg.textContent = message;
        this.preloadMsg.style.color = "#F00";
    }

    warning(message) {
        console.log(message);
        this.preloadSubMsg.innerHTML = message;
        this.preloadMsg.style.color = "#F93";
    }

    clearMessage() {
        this.preloadSubMsg.textContent = "";
        this.preloadMsg.style.color = "";
    }
}

HuesCore.oldColours =
   [{'c': 0x000000, 'n': 'black'},
    {'c': 0x550000, 'n': 'brick'},
    {'c': 0xAA0000, 'n': 'crimson'},
    {'c': 0xFF0000, 'n': 'red'},
    {'c': 0x005500, 'n': 'turtle'},
    {'c': 0x555500, 'n': 'sludge'},
    {'c': 0xAA5500, 'n': 'brown'},
    {'c': 0xFF5500, 'n': 'orange'},
    {'c': 0x00AA00, 'n': 'green'},
    {'c': 0x55AA00, 'n': 'grass'},
    {'c': 0xAAAA00, 'n': 'maize'},
    {'c': 0xFFAA00, 'n': 'citrus'},
    {'c': 0x00FF00, 'n': 'lime'},
    {'c': 0x55FF00, 'n': 'leaf'},
    {'c': 0xAAFF00, 'n': 'chartreuse'},
    {'c': 0xFFFF00, 'n': 'yellow'},
    {'c': 0x000055, 'n': 'midnight'},
    {'c': 0x550055, 'n': 'plum'},
    {'c': 0xAA0055, 'n': 'pomegranate'},
    {'c': 0xFF0055, 'n': 'rose'},
    {'c': 0x005555, 'n': 'swamp'},
    {'c': 0x555555, 'n': 'dust'},
    {'c': 0xAA5555, 'n': 'dirt'},
    {'c': 0xFF5555, 'n': 'blossom'},
    {'c': 0x00AA55, 'n': 'sea'},
    {'c': 0x55AA55, 'n': 'ill'},
    {'c': 0xAAAA55, 'n': 'haze'},
    {'c': 0xFFAA55, 'n': 'peach'},
    {'c': 0x00FF55, 'n': 'spring'},
    {'c': 0x55FF55, 'n': 'mantis'},
    {'c': 0xAAFF55, 'n': 'brilliant'},
    {'c': 0xFFFF55, 'n': 'canary'},
    {'c': 0x0000AA, 'n': 'navy'},
    {'c': 0x5500AA, 'n': 'grape'},
    {'c': 0xAA00AA, 'n': 'mauve'},
    {'c': 0xFF00AA, 'n': 'purple'},
    {'c': 0x0055AA, 'n': 'cornflower'},
    {'c': 0x5555AA, 'n': 'deep'},
    {'c': 0xAA55AA, 'n': 'lilac'},
    {'c': 0xFF55AA, 'n': 'lavender'},
    {'c': 0x00AAAA, 'n': 'aqua'},
    {'c': 0x55AAAA, 'n': 'steel'},
    {'c': 0xAAAAAA, 'n': 'grey'},
    {'c': 0xFFAAAA, 'n': 'pink'},
    {'c': 0x00FFAA, 'n': 'bay'},
    {'c': 0x55FFAA, 'n': 'marina'},
    {'c': 0xAAFFAA, 'n': 'tornado'},
    {'c': 0xFFFFAA, 'n': 'saltine'},
    {'c': 0x0000FF, 'n': 'blue'},
    {'c': 0x5500FF, 'n': 'twilight'},
    {'c': 0xAA00FF, 'n': 'orchid'},
    {'c': 0xFF00FF, 'n': 'magenta'},
    {'c': 0x0055FF, 'n': 'azure'},
    {'c': 0x5555FF, 'n': 'liberty'},
    {'c': 0xAA55FF, 'n': 'royalty'},
    {'c': 0xFF55FF, 'n': 'thistle'},
    {'c': 0x00AAFF, 'n': 'ocean'},
    {'c': 0x55AAFF, 'n': 'sky'},
    {'c': 0xAAAAFF, 'n': 'periwinkle'},
    {'c': 0xFFAAFF, 'n': 'carnation'},
    {'c': 0x00FFFF, 'n': 'cyan'},
    {'c': 0x55FFFF, 'n': 'turquoise'},
    {'c': 0xAAFFFF, 'n': 'powder'},
    {'c': 0xFFFFFF, 'n': 'white'}];
HuesCore.pastelColours =
   [{'c': 0xCD4A4A, 'n': 'Mahogany'},
    {'c': 0xFAE7B5, 'n': 'Banana Mania'},
    {'c': 0x9F8170, 'n': 'Beaver'},
    {'c': 0x232323, 'n': 'Black'},
    {'c': 0xBC5D58, 'n': 'Chestnut'},
    {'c': 0xDD9475, 'n': 'Copper'},
    {'c': 0x9ACEEB, 'n': 'Cornflower'},
    {'c': 0x2B6CC4, 'n': 'Denim'},
    {'c': 0xEFCDB8, 'n': 'Desert Sand'},
    {'c': 0x6E5160, 'n': 'Eggplant'},
    {'c': 0x1DF914, 'n': 'Electric Lime'},
    {'c': 0x71BC78, 'n': 'Fern'},
    {'c': 0xFCD975, 'n': 'Goldenrod'},
    {'c': 0xA8E4A0, 'n': 'Granny Smith Apple'},
    {'c': 0x95918C, 'n': 'Gray'},
    {'c': 0x1CAC78, 'n': 'Green'},
    {'c': 0xFF1DCE, 'n': 'Hot Magenta'},
    {'c': 0xB2EC5D, 'n': 'Inch Worm'},
    {'c': 0x5D76CB, 'n': 'Indigo'},
    {'c': 0xFDFC74, 'n': 'Laser Lemon'},
    {'c': 0xFCB4D5, 'n': 'Lavender'},
    {'c': 0xFFBD88, 'n': 'Macaroni and Cheese'},
    {'c': 0x979AAA, 'n': 'Manatee'},
    {'c': 0xFF8243, 'n': 'Mango Tango'},
    {'c': 0xFDBCB4, 'n': 'Melon'},
    {'c': 0x1A4876, 'n': 'Midnight Blue'},
    {'c': 0xFFA343, 'n': 'Neon Carrot'},
    {'c': 0xBAB86C, 'n': 'Olive Green'},
    {'c': 0xFF7538, 'n': 'Orange'},
    {'c': 0xE6A8D7, 'n': 'Orchid'},
    {'c': 0x414A4C, 'n': 'Outer Space'},
    {'c': 0xFF6E4A, 'n': 'Outrageous Orange'},
    {'c': 0x1CA9C9, 'n': 'Pacific Blue'},
    {'c': 0xC5D0E6, 'n': 'Periwinkle'},
    {'c': 0x8E4585, 'n': 'Plum'},
    {'c': 0x7442C8, 'n': 'Purple Heart'},
    {'c': 0xD68A59, 'n': 'Raw Sienna'},
    {'c': 0xE3256B, 'n': 'Razzmatazz'},
    {'c': 0xEE204D, 'n': 'Red'},
    {'c': 0x1FCECB, 'n': 'Robin Egg Blue'},
    {'c': 0x7851A9, 'n': 'Royal Purple'},
    {'c': 0xFF9BAA, 'n': 'Salmon'},
    {'c': 0xFC2847, 'n': 'Scarlet'},
    {'c': 0x9FE2BF, 'n': 'Sea Green'},
    {'c': 0xA5694F, 'n': 'Sepia'},
    {'c': 0x8A795D, 'n': 'Shadow'},
    {'c': 0x45CEA2, 'n': 'Shamrock'},
    {'c': 0xFB7EFD, 'n': 'Shocking Pink'},
    {'c': 0xECEABE, 'n': 'Spring Green'},
    {'c': 0xFD5E53, 'n': 'Sunset Orange'},
    {'c': 0xFAA76C, 'n': 'Tan'},
    {'c': 0xFC89AC, 'n': 'Tickle Me Pink'},
    {'c': 0xDBD7D2, 'n': 'Timberwolf'},
    {'c': 0x17806D, 'n': 'Tropical Rain Forest'},
    {'c': 0x77DDE7, 'n': 'Turquoise Blue'},
    {'c': 0xFFA089, 'n': 'Vivid Tangerine'},
    {'c': 0x8F509D, 'n': 'Vivid Violet'},
    {'c': 0xEDEDED, 'n': 'White'},
    {'c': 0xFF43A4, 'n': 'Wild Strawberry'},
    {'c': 0xFC6C85, 'n': 'Wild Watermelon'},
    {'c': 0xCDA4DE, 'n': 'Wisteria'},
    {'c': 0xFCE883, 'n': 'Yellow'},
    {'c': 0xC5E384, 'n': 'Yellow Green'},
    {'c': 0xFFB653, 'n': 'Yellow Orange'}];
HuesCore.weedColours =
   [{'c': 0x00FF00, 'n': 'Green'},
    {'c': 0x5A6351, 'n': 'Lizard'},
    {'c': 0x636F57, 'n': 'Cactus'},
    {'c': 0x4A7023, 'n': 'Kakapo'},
    {'c': 0x3D5229, 'n': 'Wet Moss'},
    {'c': 0x659D32, 'n': 'Tree Moss'},
    {'c': 0x324F17, 'n': 'Lime Rind'},
    {'c': 0x7F8778, 'n': 'Flight Jacket'},
    {'c': 0xBCED91, 'n': 'Green Mist'},
    {'c': 0x488214, 'n': 'Holly'},
    {'c': 0x577A3A, 'n': 'Mtn Dew Bottle'},
    {'c': 0x748269, 'n': 'Seaweed Roll'},
    {'c': 0x83F52C, 'n': 'Neon Green'},
    {'c': 0xC0D9AF, 'n': 'Lichen'},
    {'c': 0xA6D785, 'n': 'Guacamole'},
    {'c': 0x687E5A, 'n': 'Pond Scum'},
    {'c': 0x3F602B, 'n': 'Douglas Fir'},
    {'c': 0x3F6826, 'n': 'Royal Palm'},
    {'c': 0x646F5E, 'n': 'Seaweed'},
    {'c': 0x476A34, 'n': 'Noble Fir'},
    {'c': 0x5DFC0A, 'n': 'Green Led'},
    {'c': 0x435D36, 'n': 'Spinach'},
    {'c': 0x84BE6A, 'n': 'Frog'},
    {'c': 0x5B9C64, 'n': 'Emerald'},
    {'c': 0x3A6629, 'n': 'Circuit Board'},
    {'c': 0x308014, 'n': 'Sapgreen'},
    {'c': 0x31B94D, 'n': 'Pool Table'},
    {'c': 0x55AE3A, 'n': 'Leaf'},
    {'c': 0x4DBD33, 'n': 'Grass'},
    {'c': 0x596C56, 'n': 'Snake'},
    {'c': 0x86C67C, 'n': '100 Euro'},
    {'c': 0x7BCC70, 'n': 'Night Vision'},
    {'c': 0xA020F0, 'n': 'Purple'},
    {'c': 0x9B30FF, 'n': 'Purple'},
    {'c': 0x912CEE, 'n': 'Purple'},
    {'c': 0x7D26CD, 'n': 'Purple'},
    {'c': 0xAA00FF, 'n': 'Purple'},
    {'c': 0x800080, 'n': 'Purple'},
    {'c': 0xA74CAB, 'n': 'Turnip'},
    {'c': 0x8F5E99, 'n': 'Violet'},
    {'c': 0x816687, 'n': 'Eggplant'},
    {'c': 0xCC00FF, 'n': 'Grape'},
    {'c': 0x820BBB, 'n': 'Wild Violet'},
    {'c': 0x660198, 'n': 'Concord Grape'},
    {'c': 0x71637D, 'n': 'Garden Plum'},
    {'c': 0xB272A6, 'n': 'Purple Fish'},
    {'c': 0x5C246E, 'n': 'Ultramarine Violet'},
    {'c': 0x5E2D79, 'n': 'Purple Rose'},
    {'c': 0x683A5E, 'n': 'Sea Urchin'},
    {'c': 0x91219E, 'n': 'Cobalt Violet Deep'},
    {'c': 0x8B668B, 'n': 'Plum'},
    {'c': 0x9932CD, 'n': 'Dark Orchid'},
    {'c': 0xBF5FFF, 'n': 'Violet Flower'},
    {'c': 0xBDA0CB, 'n': 'Purple Candy'},
    {'c': 0x551A8B, 'n': 'Deep Purple'},
    {'c': 0xB5509C, 'n': 'Thistle'},
    {'c': 0x871F78, 'n': 'Dark Purple'},
    {'c': 0x9C6B98, 'n': 'Purple Ink'},
    {'c': 0xDB70DB, 'n': 'Orchid'},
    {'c': 0x990099, 'n': 'True Purple'},
    {'c': 0x8B008B, 'n': 'Darkmagenta'},
    {'c': 0xB62084, 'n': "Harold's Crayon"},
    {'c': 0x694489, 'n': 'Purple Rain'},
    {'c': 0xFFD700, 'n': 'Gold'}];

window.HuesCore = HuesCore;

})(window, document);