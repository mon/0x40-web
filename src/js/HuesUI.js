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

/*
    Base UI Class for Hues display. Parent is an element
    to put all your own elements under, but make a div
    underneath so it can be entirely hidden.
*/
class HuesUI {

    constructor(parent, name) {
        if(!parent) {
            return;
        }
        this.root = document.createElement("div");
        this.root.className = name ? name : this.constructor.name;
        parent.appendChild(this.root);
        this.root.style.visibility = "hidden";

        this.core = null;

        this.imageName = null;
        this.imageLink = null;

        this.songName = null;
        this.songLink = null;

        this.hueName = null;

        this.imagePrev = null;
        this.imageNext = null;
        this.songPrev = null;
        this.songNext = null;

        this.beatCount = null;
        this.timer = null;
        this.xBlur = null;
        this.yBlur = null;

        this.settingsToggle = null;
        this.hideToggle = null;

        // To deregister on UI hide we need to keep track of these
        // Each callback is { name : "callbackname", func : function }
        // Add using this.addCoreCallback
        this.callbacks = [];

        // Put this near the links to song/image lists/ Bottom right alignment
        this.listContainer = null;
        // Must be dynamic width, 64 pixels high. Will be filled with visualiser
        this.visualiserContainer = null;

        this.hidden = false;

        this.initUI();
    }

    addCoreCallback(name, func) {
        this.callbacks.push({name : name, func : func});
    }

    initUI() {
        // Major info, image, song names
        let imageName = document.createElement("div");
        this.imageName = imageName;

        this.imageLink = document.createElement("a");
        this.imageLink.target = "_blank";
        this.imageName.appendChild(this.imageLink);

        let songName = document.createElement("div");
        this.songName = songName;

        this.songLink = document.createElement("a");
        this.songLink.target = "_blank";
        this.songName.appendChild(this.songLink);

        let hueName = document.createElement("div");
        this.hueName = hueName;

        // Prev/next controls
        let imagePrev = document.createElement("div");
        imagePrev.textContent = "<";
        imagePrev.onclick = () => {this.core.previousImage();};
        this.imagePrev = imagePrev;
        let imageNext = document.createElement("div");
        imageNext.textContent = ">";
        imageNext.onclick = () =>{this.core.nextImage();};
        this.imageNext = imageNext;
        let songPrev = document.createElement("div");
        songPrev.textContent = "<";
        this.songPrev = songPrev;
        songPrev.onclick = () =>{this.core.previousSong();};
        let songNext = document.createElement("div");
        songNext.textContent = ">";
        songNext.onclick = () =>{this.core.nextSong();};
        this.songNext = songNext;

        let songList = document.createElement("div");
        songList.textContent = "SONGS";
        songList.onclick = () =>{this.core.toggleSongList();};
        this.songList = songList;
        let imageList = document.createElement("div");
        imageList.textContent = "IMAGES";
        imageList.onclick = () =>{this.core.toggleImageList();};
        this.imageList = imageList;

        // Beat timer, x and y blur, millis timer
        this.timer = document.createElement("div");
        this.timer.textContent = "T=$0x00000";

        this.beatCount = document.createElement("div");
        this.beatCount.textContent = "B=$0x0000";

        this.xBlur = document.createElement("div");
        this.xBlur.textContent = "X=$0x00";

        this.yBlur = document.createElement("div");
        this.yBlur.textContent = "Y=$0x00";

        // Config stuff
        this.settingsToggle = document.createElement("div");
        this.settingsToggle.innerHTML = '&#xe900;'; // COG
        this.settingsToggle.className = 'hues-icon';
        this.settingsToggle.onclick = () => {
            this.core.window.toggle();
        };

        this.hideToggle = document.createElement("div");
        this.hideToggle.innerHTML = "&#x25BC;";
        this.hideToggle.onclick = () => {
            this.toggleHide();
        };

        this.listContainer = document.createElement("div");
        this.visualiserContainer = document.createElement("div");

        this.addCoreCallback("newsong", this.newSong.bind(this));
        this.addCoreCallback("newimage", this.newImage.bind(this));
        this.addCoreCallback("newcolour", this.newColour.bind(this));
        this.addCoreCallback("blurupdate", this.blurUpdated.bind(this));
        this.addCoreCallback("time", this.updateTime.bind(this));
        this.addCoreCallback("invert", this.invert.bind(this));
        this.resizeHandler = this.resize.bind(this);
    }

    connectCore(core) {
        this.core = core;
        this.root.style.visibility = "visible";
        if(core.resourceManager.hasUI) {
            this.listContainer.appendChild(core.resourceManager.listView);
        }
        this.visualiserContainer.appendChild(this.core.visualiser);

        this.callbacks.forEach(function(callback) {
            core.addEventListener(callback.name, callback.func);
        });
        window.addEventListener('resize', this.resizeHandler);
        this.resizeHandler();
    }

    disconnect() {
        this.callbacks.forEach(callback => {
            this.core.removeEventListener(callback.name, callback.func);
        });
        this.core = null;
        this.root.style.visibility = "hidden";
        while (this.listContainer.firstElementChild) {
            this.listContainer.removeChild(this.listContainer.firstElementChild);
        }
        while (this.visualiserContainer.firstElementChild) {
            this.visualiserContainer.removeChild(this.visualiserContainer.firstElementChild);
        }
        window.removeEventListener('resize', this.resizeHandler);
    }

    // ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
    show() {
        this.root.style.visibility = "visible";
    }

    // ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
    hide() {
        this.root.style.visibility = "hidden";
    }

    toggleHide() {
        this.hidden = !this.hidden;
        if(this.hidden) {
            this.root.classList.add("hues-ui--hidden");
        } else {
            this.root.classList.remove("hues-ui--hidden");
        }
    }

    resize() {}
    updateVolume(vol) {}

    newSong(song) {
        if(!song) {
            return;
        }

        this.songLink.textContent = song.title.toUpperCase();
        this.songLink.href = song.source;
    }

    newImage(image) {
        if(!image) {
            return;
        }

        let name = image.fullname ? image.fullname : image.name;

        this.imageLink.textContent = name.toUpperCase();
        this.imageLink.href = image.source ? image.source : "";
    }

    newColour(colour) {
        this.hueName.textContent = colour.n.toUpperCase();
    }

    blurUpdated(x, y) {
        x = Math.floor(x * 0xFF);
        y = Math.floor(y * 0xFF);
        this.xBlur.textContent = "X=" + this.intToHex(x, 2);
        this.yBlur.textContent = "Y=" + this.intToHex(y, 2);
    }

    updateTime(time) {
        time = Math.floor(time * 1000);
        this.timer.textContent = "T=" + this.intToHex(time, 5);
    }

    intToHex(num, pad) {
        let str = Math.abs(num).toString(16);
        while (str.length < pad)
            str = "0" + str;
        let prefix = num < 0 ? "-" : "$";
        return prefix + "0x" + str;
    }

    invert(invert) {
        if (invert) {
            this.root.classList.add("inverted");
        } else {
            this.root.classList.remove("inverted");
        }
    }
}

/*
 Individual UIs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

class RetroUI extends HuesUI {
    constructor(parent, name) {
        super(parent, name ? name : "RetroUI");
    }

    initUI() {
        super.initUI();

        let container = document.createElement("div");
        container.className = "hues-r-container";
        this.root.appendChild(container);
        this.container = container;

        this.mode = document.createElement("div");
        container.appendChild(this.mode);
        container.appendChild(this.imageName);
        container.appendChild(this.timer);
        container.appendChild(this.beatCount);
        container.appendChild(this.xBlur);
        container.appendChild(this.yBlur);

        this.colourIndex = document.createElement("div");
        this.colourIndex.textContent = "C=$0x00";
        container.appendChild(this.colourIndex);

        this.version = document.createElement("div");
        container.appendChild(this.version);

        container.appendChild(this.hueName);
        container.appendChild(this.songName);

        this.beatBar = document.createElement("div");
        container.appendChild(this.beatBar);

        this.controls = document.createElement("div");
        this.controls.className = "hues-r-controls";

        let imageMode = document.createElement("div");
        this.imageModeManual = document.createElement("div");
        this.imageModeManual.textContent = "NORMAL";
        this.imageModeManual.onclick = () => {
            this.core.setIsFullAuto(false);
        };
        this.imageModeManual.className = "hues-r-manualmode hues-r-button";
        this.imageModeAuto = document.createElement("div");
        this.imageModeAuto.textContent = "FULL AUTO";
        this.imageModeAuto.onclick = () => {
            this.core.setIsFullAuto(true);
        };
        this.imageModeAuto.className = "hues-r-automode hues-r-button";
        imageMode.appendChild(this.imageModeManual);
        imageMode.appendChild(this.imageModeAuto);

        this.imagePrev.className = "hues-r-button";
        this.imageNext.className = "hues-r-button";
        this.songPrev.className = "hues-r-button";
        this.songNext.className = "hues-r-button";
        this.controls.appendChild(this.imagePrev);
        this.controls.appendChild(imageMode);
        this.controls.appendChild(this.imageNext);

        this.songList.className = "hues-r-songs hues-r-button";
        this.controls.appendChild(this.songPrev);
        this.controls.appendChild(this.songList);
        this.controls.appendChild(this.songNext);

        this.root.appendChild(this.controls);

        let subControl = document.createElement("div");
        subControl.className = "hues-r-subcontrols";
        subControl.appendChild(this.settingsToggle);
        this.imageList.textContent = "C";
        subControl.appendChild(this.imageList);
        subControl.appendChild(this.hideToggle);
        this.subControls = subControl;

        this.root.appendChild(subControl);

        this.hideRestore = document.createElement("div");
        this.hideRestore.className = "hues-r-hiderestore";
        this.hideRestore.innerHTML = "&#x25B2;";
        this.hideRestore.onclick = () => {
            this.toggleHide();
        };
        this.root.appendChild(this.hideRestore);

        this.listContainer.className = "hues-r-listcontainer";
        this.root.appendChild(this.listContainer);

        this.visualiserContainer.className = "hues-r-visualisercontainer";
        this.root.appendChild(this.visualiserContainer);

        this.addCoreCallback("beat", this.beat.bind(this));
        this.addCoreCallback("newmode", this.newMode.bind(this));
    }

    toggleHide() {
        this.hidden = !this.hidden;
        if(this.hidden) {
            this.subControls.classList.add("hues-ui--hidden");
            this.controls.classList.add("hues-ui--hidden");
            this.container.classList.add("hues-ui--hidden");
            this.hideRestore.classList.add("hues-ui--hidden");
        } else {
            this.subControls.classList.remove("hues-ui--hidden");
            this.controls.classList.remove("hues-ui--hidden");
            this.container.classList.remove("hues-ui--hidden");
            this.hideRestore.classList.remove("hues-ui--hidden");
        }
    }

    connectCore(core) {
        super.connectCore(core);

        this.version.textContent = "V=$" + core.versionHex;
    }

    newMode(isAuto) {
        this.mode.textContent = "M=" + (isAuto ? "FULL AUTO" : "NORMAL");
    }

    newImage(image) {
        if(!image) {
            return;
        }

        this.imageLink.textContent = "I=" + image.name.toUpperCase();
        this.imageLink.href = image.source;
    }

    newColour(colour) {
        super.newColour(colour);

        this.colourIndex.textContent = "C=" + this.intToHex(this.core.colourIndex, 2);
    }

    beat(beats, index) {
        let rest = beats.slice(1);
        this.beatBar.textContent = ">>" + rest;
        this.beatCount.textContent = "B=" + this.intToHex(index, 4);
    }

    resize() {
        this.core.visualiser.width = this.visualiserContainer.offsetWidth;
        this.core.resizeVisualiser();
    }
}

class MinimalUI extends RetroUI {
    constructor(parent, name) {
        super(parent, name ? name : "MinimalUI");
    }

    initUI() {
        super.initUI();

        this.root.removeChild(this.controls);
        this.root.removeChild(this.subControls);
        this.container.removeChild(this.beatBar);
        this.container.innerHTML = "";
        this.container.appendChild(this.beatBar);
    }
}

class WeedUI extends RetroUI {
    constructor(parent, name) {
        super(parent, name ? name : "WeedUI");

        this.xVariance = 10;
        this.yVariance = 20;
    }

    initUI() {
        super.initUI();

        this.container.removeChild(this.beatBar);

        this.controls.className = "hues-w-controls";
        this.subControls.className = "hues-w-subcontrols";

        let beatBar = document.createElement("div");
        beatBar.className = "hues-w-beatbar";
        this.root.appendChild(beatBar);
        this.beatBar = beatBar;

        let beatLeft = document.createElement("div");
        beatLeft.className = "hues-w-beatleft";
        beatBar.appendChild(beatLeft);
        this.beatLeft = beatLeft;

        let beatRight = document.createElement("div");
        beatRight.className = "hues-w-beatright";
        beatBar.appendChild(beatRight);
        this.beatRight = beatRight;

        this.imageModeManual.textContent = "ONE";
        this.imageModeAuto.textContent = "MANY";

        this.visualiserContainer.className += " hues-w-visualisercontainer";
    }

    toggleHide() {
        super.toggleHide(this);
        if(this.hidden) {
            this.beatBar.classList.add("hues-ui--hidden");
        } else {
            this.beatBar.classList.remove("hues-ui--hidden");
        }
    }

    beat(beats, index) {
        let rest = beats.slice(1);

        this.beatLeft.textContent = rest;
        this.beatRight.textContent = rest;

        this.beatCount.textContent = "B=" + this.intToHex(index, 4);

        if(["x", "o", "X", "O"].indexOf(beats[0]) != -1) {
            let beatCenter = document.createElement("div");
            beatCenter.className = "hues-w-beataccent";
            let rot = this.round10(15 - Math.random() * 30);
            let x = this.round10(- this.xVariance / 2 + Math.random() * this.xVariance);
            let y = this.round10(30 - this.yVariance / 2 + Math.random() * this.yVariance);
            let transform = "rotate(" + rot + "deg) translate(" + x + "px, " + y + "px)";
            beatCenter.style.MozTransform    = transform;
            beatCenter.style.webkitTransform = transform;
            beatCenter.style.transform       = transform;
            beatCenter.textContent = beats[0].toUpperCase();
            this.root.appendChild(beatCenter);
            window.setTimeout(this.removeBeat.bind(this, beatCenter), 1500);
        }
    }

    round10(num) {
        return Math.round(num * 10) / 10;
    }

    removeBeat(element) {
        this.root.removeChild(element);
    }
}

class ModernUI extends HuesUI {
    constructor(parent, name) {
        super(parent, name ? name : "ModernUI");

        this.textSize_normal = 0;
        this.textSize_small = 0;
        this.songLink_size = 0;
        this.imageLink_size = 0;

        this.currentBeat = ".";

        this.hidden = 0; // we have a 3 stage hide
    }

    initUI() {
        super.initUI();

        this.imageName.className = "hues-m-imagename";
        this.songName.className = "hues-m-songtitle";

        let controls = document.createElement("div");
        controls.className = "hues-m-controls";
        this.root.appendChild(controls);
        this.controls = controls;

        controls.appendChild(this.imageName);
        controls.appendChild(this.songName);

        let leftBox = document.createElement("div");
        leftBox.className = "hues-m-leftbox";
        controls.appendChild(leftBox);
        this.leftBox = leftBox;

        this.hueName.className = "hues-m-huename";
        leftBox.appendChild(this.hueName);

        let volCluster = document.createElement("div");
        volCluster.className = "hues-m-vol-cluster";
        leftBox.appendChild(volCluster);

        this.settingsToggle.className += " hues-m-cog";
        volCluster.appendChild(this.settingsToggle);

        this.hideToggle.className = "hues-m-hide";
        volCluster.appendChild(this.hideToggle);

        let volBar = document.createElement("div");
        volBar.className = "hues-m-vol-bar";
        this.volBar = volBar;
        volCluster.appendChild(volBar);

        let label = document.createElement("div");
        label.textContent = "VOL";
        label.className = "hues-m-vol-label";
        label.onclick = () => {
            this.core.soundManager.toggleMute();
        };
        volBar.appendChild(label);
        this.volLabel = label;

        this.infoToggle = document.createElement("div");
        this.infoToggle.innerHTML = '?';
        this.infoToggle.className = "hues-m-question";
        this.infoToggle.onclick = () => {
            this.core.window.selectTab("INFO");
        };
        volCluster.appendChild(this.infoToggle);

        let input = document.createElement("input");
        input.type = "range";
        input.min = 0;
        input.max = 1;
        input.step = 0.1;
        volBar.appendChild(input);
        this.volInput = input;
        input.oninput = () => {
            this.core.soundManager.setVolume(parseFloat(input.value));
        };

        let rightBox = document.createElement("div");
        rightBox.className = "hues-m-rightbox";
        controls.appendChild(rightBox);
        this.rightBox = rightBox;

        //Song/image controls
        let songs = document.createElement("div");
        songs.className = "hues-m-controlblock";
        this.songBlock = songs;
        this.songList.className = "hues-m-songbutton";

        let songControls = document.createElement("div");
        songControls.className = "hues-m-controlbuttons";
        this.songPrev.className = "hues-m-prevbutton";
        this.songNext.className = "hues-m-nextbutton";
        this.songShuffle = document.createElement("div");
        this.songShuffle.innerHTML = '&#xe903;'; // SHUFFLE
        this.songShuffle.className = "hues-m-actbutton hues-icon";
        this.songShuffle.onclick = () => {this.core.randomSong();};
        songs.appendChild(this.songList);
        songControls.appendChild(this.songPrev);
        songControls.appendChild(this.songShuffle);
        songControls.appendChild(this.songNext);
        songs.appendChild(songControls);
        rightBox.appendChild(songs);

        let images = document.createElement("div");
        images.className = "hues-m-controlblock";
        this.imageList.className = "hues-m-songbutton";
        this.imageBlock = images;

        let imageControls = document.createElement("div");
        imageControls.className = "hues-m-controlbuttons";

        this.imageMode = document.createElement("div");
        this.imageMode.innerHTML = "&#xe901;"; // PLAY
        this.imageMode.className = "hues-m-actbutton hues-icon";
        this.imageMode.onclick = () => {this.core.toggleFullAuto();};
        this.imagePrev.className = "hues-m-prevbutton";
        this.imageNext.className = "hues-m-nextbutton";
        images.appendChild(this.imageList);
        imageControls.appendChild(this.imagePrev);
        imageControls.appendChild(this.imageMode);
        imageControls.appendChild(this.imageNext);
        images.appendChild(imageControls);
        rightBox.appendChild(images);

        let leftInfo = document.createElement("div");
        leftInfo.className = "hues-m-leftinfo";
        let rightInfo = document.createElement("div");
        rightInfo.className = "hues-m-rightinfo";
        leftInfo.appendChild(this.xBlur);
        leftInfo.appendChild(this.yBlur);
        rightInfo.appendChild(this.timer);
        rightInfo.appendChild(this.beatCount);
        this.rightInfo = rightInfo;
        this.leftInfo = leftInfo;
        controls.appendChild(leftInfo);
        controls.appendChild(rightInfo);

        this.visualiserContainer.className = "hues-m-visualisercontainer";
        controls.appendChild(this.visualiserContainer);

        let beatBar = document.createElement("div");
        beatBar.className = "hues-m-beatbar";
        this.root.appendChild(beatBar);
        this.beatBar = beatBar;

        let beatLeft = document.createElement("div");
        beatLeft.className = "hues-m-beatleft";
        beatBar.appendChild(beatLeft);
        this.beatLeft = beatLeft;

        let beatRight = document.createElement("div");
        beatRight.className = "hues-m-beatright";
        beatBar.appendChild(beatRight);
        this.beatRight = beatRight;

        let beatCenter = document.createElement("div");
        beatCenter.className = "hues-m-beatcenter";
        this.root.appendChild(beatCenter);
        this.beatCenter = beatCenter;

        this.hideRestore = document.createElement("div");
        this.hideRestore.className = "hues-m-hiderestore";
        this.hideRestore.onclick = () => {
            this.toggleHide();
        };
        this.root.appendChild(this.hideRestore);

        this.listContainer.className = "hues-m-listcontainer";
        this.root.appendChild(this.listContainer);

        this.addCoreCallback("beat", this.beat.bind(this));
        this.addCoreCallback("newmode", this.newMode.bind(this));
    }

    toggleHide() {
        // classList is new-ish, but if you have web audio you'll have this
        this.beatBar.classList.remove("hues-ui--hidden");
        this.beatCenter.classList.remove("hues-ui--hidden");
        this.controls.classList.remove("hues-ui--hidden");
        this.hideRestore.classList.remove("hues-ui--hidden");
        switch(this.hidden) {
            case 1:
                this.beatBar.classList.add("hues-ui--hidden");
                this.beatCenter.classList.add("hues-ui--hidden");
                /* falls through */
            case 0:
                this.controls.classList.add("hues-ui--hidden");
                this.hideRestore.classList.add("hues-ui--hidden");
        }
        this.hidden = (this.hidden+1) % 3;
    }

    updateVolume(vol) {
        this.volInput.value = vol;
        if(vol === 0) {
            this.volLabel.textContent = "(VOL)";
        } else {
            this.volLabel.textContent = "VOL";
        }
    }

    newMode (isAuto) {
        if(isAuto) {
            this.imageMode.innerHTML = '&#xe902;'; // PAUSE;
        } else {
            this.imageMode.innerHTML = "&#xe901;"; // PLAY
        }
    }

    beat(beats, index) {
        this.currentBeat = beats[0];
        let rest = beats.slice(1);

        this.beatLeft.textContent = rest;
        this.beatRight.textContent = rest;


        if (this.currentBeat != ".") {
            while (this.beatCenter.firstElementChild) {
                this.beatCenter.removeChild(this.beatCenter.firstElementChild);
            }
            let span = this.beatCenter.ownerDocument.createElement("span");
            span.textContent = this.currentBeat;
            this.beatCenter.appendChild(span);
        }
        this.beatCount.textContent = "B=" + this.intToHex(index, 4);
    }

    // get the width of a single character in the link box for a given classname
    textWidth(className) {
        // Could be song or image link, don't care
        let el = this.songLink;
        let oldContent = el.innerHTML;

        // offsetWidth is rounded, divide by 100
        let text = "";
        for(let i = 0; i < 100; i++) {
            text += "&nbsp;";
        }
        el.innerHTML = text;
        // We override this just after so don't bother to restore it
        el.className = className;
        let size = el.offsetWidth / 100;

        el.innerHTML = oldContent;

        return size;
    }

    resize() {
        this.textSize_normal = this.textWidth("");
        this.textSize_small = this.textWidth("small");
        this.songLink_size = this.songName.clientWidth;
        this.imageLink_size = this.imageName.clientWidth;

        this.resizeSong();
        this.resizeImage();
        this.core.visualiser.width = this.controls.offsetWidth;
        this.core.resizeVisualiser();
    }

    resizeElement(el, parentSize) {
        let chars = el.textContent.length;
        if (chars * this.textSize_normal < parentSize) {
            el.className = "";
        } else if(chars * this.textSize_small < parentSize) {
            el.className = "small";
        } else {
            el.className = "x-small";
        }
    }

    resizeSong() {
        this.resizeElement(this.songLink, this.songLink_size);
    }

    resizeImage() {
        this.resizeElement(this.imageLink, this.imageLink_size);
    }

    newSong(song) {
        super.newSong(song);

        if(!song) {
            return;
        }

        this.resizeSong();
    }

    newImage(image) {
        super.newImage(image);

        if(!image) {
            return;
        }

        this.resizeImage();
    }
}

class XmasUI extends ModernUI {
    constructor(parent, name) {
        super(parent, name ? name : "XmasUI");
        this.initSnow();

         // This will cache our inverted lights images
        this.invert(true);

        this.controls.removeChild(this.leftBox);
        this.controls.removeChild(this.rightBox);
        this.controls.removeChild(this.rightInfo);
        this.controls.removeChild(this.leftInfo);

        this.leftBox = null;
        this.rightBox = null;
        this.hueName = null;
        this.xBlur = null;
        this.yBlur = null;
        this.timer = null;

        this.controls.className += " hues-x-controls";
        this.beatBar.className += " hues-x-beatbar";

        this.lights = [];

        let wires = document.createElement("div");
        wires.className = "hues-x-wires";

        let left = document.createElement("div");
        left.className = "hues-x-wiresleft";
        xleft.forEach(function(l, i, a) {
            let light = this.newLight(l, left);
            light.style.transform = "rotate(" + l.angle + "deg)";
            light.style.left = l.x + "px";
            light.style.top = l.y + "px";
            this.lights.push(light);
        }, this);

        let right = document.createElement("div");
        right.className = "hues-x-wiresright";
        xright.forEach(function(l, i, a) {
            let light = this.newLight(l, right);
            light.style.transform = "rotate(" + (-l.angle) + "deg)";
            light.style.right = l.x + "px";
            light.style.top = l.y + "px";
            this.lights.push(light);
        }, this);

        let bottomHelper = document.createElement("div");
        bottomHelper.className = "hues-x-wiresbottomhelper";
        let bottom = document.createElement("div");
        bottom.className = "hues-x-wiresbottom";
        xbottom.forEach(function(l, i, a) {
            let light = this.newLight(l, bottom);
            light.style.transform = "rotate(" + l.angle + "deg)";
            light.style.left = l.x + "px";
            light.style.bottom = l.y + "px";
            this.lights.push(light);
        }, this);

        wires.appendChild(left);
        wires.appendChild(right);
        bottomHelper.appendChild(bottom);
        wires.appendChild(bottomHelper);
        this.root.appendChild(wires);

        this.visualiserContainer.className = "hues-x-visualisercontainer";
        this.controls.removeChild(this.visualiserContainer);
        this.beatBar.appendChild(this.visualiserContainer);
    }

    invert(invert) {
        super.invert(invert);

        if(invert) {
            this.snowContext.fillStyle = "rgba(0, 0, 0, 0.8)";
        } else {
            this.snowContext.fillStyle = "rgba(255, 255, 255, 0.8)";
        }
    }

    connectCore(core) {
        super.connectCore(core);
        this.startSnow();
    }

    disconnect() {
        this.stopSnow();
        super.disconnect();
    }

    lightOn(light) {
        light.on.className = "hues-x-lighton";
        light.off.className = "hues-x-lightoff";
    }

    lightOff(light) {
        light.on.className = "hues-x-lighton off";
        light.off.className = "hues-x-lightoff off";
    }

    lightFadeOut(light) {
        light.on.className = "hues-x-lighton hues-x-fade off";
        light.off.className = "hues-x-lightoff hues-x-fade off";
    }

    lightRecolour(light) {
        let hue = Math.floor(Math.random() * 7) * -56;
        light.on.style.backgroundPosition = hue + "px 0";
        light.off.style.backgroundPosition = hue + "px 0";
    }

    randomLight(light) {
        if(Math.random() >= 0.5) {
            this.lightOn(light);
        } else {
            this.lightOff(light);
        }
    }

    newLight(l, parent) {
        let light = document.createElement("div");
        light.className = "hues-x-light";
        let bulb = document.createElement("div");
        let on = document.createElement("div");
        let off = document.createElement("div");
        bulb.appendChild(on);
        bulb.appendChild(off);
        light.appendChild(bulb);
        parent.appendChild(light);
        light.on = on;
        light.off = off;
        light.bulb = bulb;
        this.randomLight(light);
        this.lightRecolour(light);
        return light;
    }

    beat(beats, index) {
        super.beat(beats, index);
        if(this.currentBeat != ".") {
            this.lights.forEach(function(light, i, a) {
                switch(this.currentBeat) {
                    case ":":
                        this.lightOn(light);
                        this.lightRecolour(light);
                        break;
                    case "+":
                        this.lightFadeOut(light);
                        break;
                    default:
                        this.randomLight(light);
                }
            }, this);
        }
    }

    initSnow() {
        this.snowCanvas = document.createElement("canvas");
        this.snowContext = this.snowCanvas.getContext("2d");
        this.snowCanvas.width = 1280;
        this.snowCanvas.height = 720;
        this.snowCanvas.style.display = "none";
        this.snowCanvas.className = "hues-canvas hues-x-snow";

        this.root.appendChild(this.snowCanvas);

        this.snowing = false;
        this.maxSnow = 30;
        this.snowAngle = 0;
        this.lastSnow = 0;
        this.snowflakes = [];

        this.addCoreCallback("frame", this.drawSnow.bind(this));
    }

    // From http://thecodeplayer.com/walkthrough/html5-canvas-snow-effect

    startSnow() {
        this.snowing = true;
        this.snowCanvas.style.display = "block";
        let height = this.snowCanvas.height;
        let width = this.snowCanvas.width;
        this.snowAngle = 0;
        this.snowflakes = [];
        for(let i = 0; i < this.maxSnow; i++) {
            this.snowflakes.push({
                x: Math.random()*width, //x-coordinate
                y: Math.random()*height, //y-coordinate
                r: Math.random()*4+1, //radius
                d: Math.random()*25 //density
            });
        }
        this.lastSnow = Date.now() / 1000;
    }

    stopSnow() {
        this.snowing = false;
        this.snowCanvas.style.display = "none";
    }

    drawSnow() {
        let width = this.snowCanvas.width;
        let height = this.snowCanvas.height;
        let now = Date.now() / 1000;
        let delta = this.lastSnow - now;
        this.lastSnow = now;
        this.snowContext.clearRect(0, 0, width, height);

        this.snowContext.beginPath();
        for(let i = 0; i < this.maxSnow; i++) {
            let flake = this.snowflakes[i];
            this.snowContext.moveTo(flake.x, flake.y);
            this.snowContext.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2, true);
        }
        this.snowContext.fill();

        this.snowAngle += delta / 6;
        for(let i = 0; i < this.maxSnow; i++) {
            let flake = this.snowflakes[i];
            //Updating X and Y coordinates
            //We will add 1 to the cos function to prevent negative values which will lead flakes to move upwards
            //Every particle has its own density which can be used to make the downward movement different for each flake
            //Lets make it more random by adding in the radius
            flake.y += Math.cos(this.snowAngle + flake.d) + 1 + flake.r / 2;
            flake.x += Math.sin(this.snowAngle) * 2;

            //Sending flakes back from the top when it exits
            //Lets make it a bit more organic and let flakes enter from the left and right also.
            if(flake.x > width + 5 || flake.x < -5 || flake.y > height) {
                if(i % 3 > 0) {//66.67% of the flakes
                    this.snowflakes[i] = {x: Math.random() * width, y: -10, r: flake.r, d: flake.d};
                }
                else {
                    //If the flake is exitting from the right
                    if(Math.sin(this.snowAngle) > 0) {
                        //Enter from the left
                        this.snowflakes[i] = {x: -5, y: Math.random() * height, r: flake.r, d: flake.d};
                    }
                    else {
                        //Enter from the right
                        this.snowflakes[i] = {x: width+5, y: Math.random() * height, r: flake.r, d: flake.d};
                    }
                }
            }
        }
    }

    resize() {
        super.resize();

        let ratio = window.innerWidth / window.innerHeight;
        // cleared on resize
        let savedFill = this.snowContext.fillStyle;
        this.snowCanvas.width = Math.ceil(720 * ratio);
        this.snowContext.fillStyle = savedFill;
    }

    newColour(colour) {}
    blurUpdated(x, y) {}
    updateTime(time) {}
}

class HalloweenUI extends ModernUI {
    constructor(parent, name) {
        super(parent, name ? name : "HalloweenUI");
        // This will cache our inverted tombstone image
        this.invert(true);
    }

    initUI() {
        super.initUI();

        this.controls.className += " hues-h-controls";
        this.beatBar.className += " hues-h-beatbar";
        this.leftBox.className += " hues-h-leftbox";
        this.rightBox.className += " hues-h-rightbox";
        this.volBar.className += " hues-h-vol-bar";

        this.beatLeft.className += " hues-h-text";
        this.beatRight.className += " hues-h-text";
        this.beatCenter.className += " hues-h-text";
        this.songShuffle.className += " hues-h-text";
        this.songNext.className += " hues-h-text";
        this.songPrev.className += " hues-h-text";
        this.songList.className += " hues-h-text";
        this.songName.className += " hues-h-text";
        this.imageMode.className += " hues-h-text";
        this.imageNext.className += " hues-h-text";
        this.imagePrev.className += " hues-h-text";
        this.imageList.className += " hues-h-text";
        this.imageName.className += " hues-h-text";
        this.hueName.className += " hues-h-text";

        this.settingsToggle.className += " hues-h-text";
        this.hideToggle.className += " hues-h-text";
        this.infoToggle.className += " hues-h-text";
        this.volLabel.className += " hues-h-text";

        this.timer.className = "hues-h-textfade";
        this.beatCount.className = "hues-h-textfade";
        this.xBlur.className = "hues-h-textfade";
        this.yBlur.className = "hues-h-textfade";

        let leftBoxTomb = document.createElement("div");
        leftBoxTomb.className = "hues-h-tombstone";
        this.leftBox.appendChild(leftBoxTomb);

        let songTomb = document.createElement("div");
        songTomb.className = "hues-h-tombstone";
        this.songBlock.insertBefore(songTomb,this.songBlock.firstChild);

        let imageTomb = document.createElement("div");
        imageTomb.className = "hues-h-tombstone";
        this.imageBlock.insertBefore(imageTomb,this.imageBlock.firstChild);

        let topLeft = document.createElement("div");
        topLeft.className = "hues-h-topleft";
        let topRight = document.createElement("div");
        topRight.className = "hues-h-topright";
        let bottomRight = document.createElement("div");
        bottomRight.className = "hues-h-bottomright";

        this.root.appendChild(topLeft);
        this.root.appendChild(topRight);
        this.root.appendChild(bottomRight);

        let leftHand = document.createElement("div");
        leftHand.className = "hues-h-left-hand";
        this.beatBar.appendChild(leftHand);
        let rightHand = document.createElement("div");
        rightHand.className = "hues-h-right-hand";
        this.beatBar.appendChild(rightHand);

        this.vignette = document.createElement("div");
        this.vignette.className = "hues-h-vignette";
        this.root.appendChild(this.vignette);
    }

    beat(beats, index) {
        super.beat(beats, index);

        if (this.currentBeat != ".") {
            let eyes = this.beatCenter.ownerDocument.createElement("div");
            eyes.className = "hues-m-beatcenter hues-h-eyes";
            this.beatCenter.appendChild(eyes);
        }
    }

    connectCore(core) {
        super.connectCore(core);

        this.core.preloader.classList.add("hues-h-text");
    }

    disconnect() {
        this.core.preloader.classList.remove("hues-h-text");

        super.disconnect();
    }
}

// Positions and angles for the Xmas lights
let xleft = [
    {"angle": 122.529582194, "x": 19.4, "y": -19.35},
    {"angle": 92.5309436511, "x": 25.4, "y": 38.7},
    {"angle": 107.530202659, "x": 39.4, "y": 107.75},
    {"angle": 77.5309700777, "x": 20.75, "y": 184.8},
    {"angle": 77.5309700777, "x": 32.3, "y": 249.8},
    {"angle": 107.530202659, "x": 40.45, "y": 327.9},
    {"angle": 88.3307935055, "x": 35, "y": 410.9},
    {"angle": 107.530202659, "x": 54.35, "y": 490.95},
    {"angle": 74.9981580491, "x": 28.15, "y": 573.8},
    {"angle": 89.9973772074, "x": 23.45, "y": 675.35},
    {"angle": 107.530202659, "x": 21.65, "y": 762.6},
    {"angle": 107.530202659, "x": 15.8, "y": 842.75},
    {"angle": 92.5309436511, "x": 36.55, "y": 905.7},
    {"angle": 88.3307935055, "x": 31.1, "y": 988.7},
    {"angle": 107.530202659, "x": 50.45, "y": 1068.75},
    {"angle": 74.9981580491, "x": 45.75, "y": 1158.5},
    {"angle": 88.3307935055, "x": 35.85, "y": 1238.55}
];
let xright = [
    {"angle": 120.001009518, "x": 33.3, "y": -29.75},
    {"angle": 90.0026227926, "x": 35.35, "y": 53.65},
    {"angle": 102.469029922, "x": 41.5, "y": 136.5},
    {"angle": 91.6692064945, "x": 22.15, "y": 216.55},
    {"angle": 72.4697973408, "x": 34.4, "y": 278.25},
    {"angle": 102.469029922, "x": 45.75, "y": 361.85},
    {"angle": 87.4699314665, "x": 26.65, "y": 426.35},
    {"angle": 72.4697973408, "x": 41.6, "y": 502.15},
    {"angle": 102.469029922, "x": 27.5, "y": 566},
    {"angle": 72.4697973408, "x": 7.65, "y": 638.45},
    {"angle": 102.469029922, "x": 11, "y": 721.25},
    {"angle": 76.1887724128, "x": 7.65, "y": 792.7},
    {"angle": 87.4690563489, "x": 36.15, "y": 850.35},
    {"angle": 102.46813454, "x": 16.6, "y": 924.3},
    {"angle": 72.4697973408, "x": 15.3, "y": 990.8},
    {"angle": 76.1887724128, "x": 11.95, "y": 1062.25},
    {"angle": 87.4690563489, "x": 40.45, "y": 1119.9},
    {"angle": 102.46813454, "x": 20.9, "y": 1193.85}
];
let xbottom = [
    {"angle": 32.5804579323, "x": 110.35, "y": -12.1},
    {"angle": 3.28979777069, "x": 168.05, "y": -5.55},
    {"angle": 17.6989154099, "x": 238.35, "y": 7.7},
    {"angle": -12.6587029361, "x": 314.8, "y": -10.4},
    {"angle": -12.6587029361, "x": 379.4, "y": 1.05},
    {"angle": 17.6989154099, "x": 457.75, "y": 9.4},
    {"angle": 2.59102780115, "x": 540.6, "y": 3.75},
    {"angle": 17.6989154099, "x": 620.35, "y": 22.7},
    {"angle": -15.134241831, "x": 703, "y": -2.9},
    {"angle": 2.30443717424, "x": 804.75, "y": -7.85},
    {"angle": 17.6989154099, "x": 892.45, "y": -9.55},
    {"angle": 17.6989154099, "x": 971.65, "y": -15.5},
    {"angle": 3.28979777069, "x": 1035.2, "y": 4.35},
    {"angle": 2.59102780115, "x": 1118, "y": 0.2},
    {"angle": 17.6989154099, "x": 1198.05, "y": 18.95},
    {"angle": -18.378894807, "x": 1288.2, "y": 14.2},
    {"angle": -4.561224264, "x": 1367.9, "y": 4.6},
    {"angle": 32.5804579323, "x": 1452.6, "y": -1.7},
    {"angle": 3.28979777069, "x": 1511.45, "y": 4.45},
    {"angle": 17.6989154099, "x": 1580.6, "y": 17.6},
    {"angle": -12.6587029361, "x": 1656.6, "y": -0.95},
    {"angle": -12.6587029361, "x": 1722.1, "y": 11.1},
    {"angle": 17.6989154099, "x": 1800.5, "y": 18.8},
    {"angle": 2.59102780115, "x": 1883.1, "y": 13},
    {"angle": 17.6989154099, "x": 1963, "y": 32.6},
    {"angle": -15.134241831, "x": 2045.8, "y": 7},
    {"angle": 2.30443717424, "x": 2147.55, "y": 1.55},
    {"angle": 17.6989154099, "x": 2234.1, "y": 0.4},
    {"angle": 17.6989154099, "x": 2315, "y": -5.6},
    {"angle": 3.28979777069, "x": 2377.8, "y": 14.5},
    {"angle": 2.59102780115, "x": 2460.65, "y": 9.75},
    {"angle": 17.6989154099, "x": 2540.2, "y": 28.5},
    {"angle": -18.378894807, "x": 2627.55, "y": 24.9},
    {"angle": -4.561224264, "x": 2710.4, "y": 14.4}
];

window.RetroUI = RetroUI;
window.WeedUI = WeedUI;
window.ModernUI = ModernUI;
window.XmasUI = XmasUI;
window.HalloweenUI = HalloweenUI;
window.MinimalUI = MinimalUI;

})(window, document);