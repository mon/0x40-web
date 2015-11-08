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

/*
    Base UI Class for Hues display. Parent is an element
    to put all your own elements under, but make a div
    underneath so it can be entirely hidden.
*/
function HuesUI(parent) {
    if(!parent) {
        parent = document.getElementById("huesUI");
    }
    this.root = document.createElement("div");
    this.root.className = this.constructor.name;
    parent.appendChild(this.root);
    this.root.style.display = "none";

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

    // Put this near the links to song/image lists/ Bottom right alignment
    this.listContainer = null;

    this.hidden = false;

    this.initUI();
}

HuesUI.prototype.initUI = function() {
    var that = this;

    // Major info, image, song names
    var imageName = document.createElement("div");
    this.imageName = imageName;

    this.imageLink = document.createElement("a");
    this.imageLink.target = "_blank";
    this.imageName.appendChild(this.imageLink);

    var songName = document.createElement("div");
    this.songName = songName;

    this.songLink = document.createElement("a");
    this.songLink.target = "_blank";
    this.songName.appendChild(this.songLink);

    var hueName = document.createElement("div");
    this.hueName = hueName;

    // Prev/next controls
    var imagePrev = document.createElement("div");
    imagePrev.textContent = "<";
    imagePrev.onclick = function() {that.core.previousImage();};
    this.imagePrev = imagePrev;
    var imageNext = document.createElement("div");
    imageNext.textContent = ">";
    imageNext.onclick = function() {that.core.nextImage();};
    this.imageNext = imageNext;
    var songPrev = document.createElement("div");
    songPrev.textContent = "<";
    this.songPrev = songPrev;
    songPrev.onclick = function() {that.core.previousSong();};
    var songNext = document.createElement("div");
    songNext.textContent = ">";
    songNext.onclick = function() {that.core.nextSong();};
    this.songNext = songNext;

    var songList = document.createElement("div");
    songList.textContent = "SONGS";
    songList.onclick = function() {that.core.toggleSongList();};
    this.songList = songList;
    var imageList = document.createElement("div");
    imageList.textContent = "IMAGES";
    imageList.onclick = function() {that.core.toggleImageList();};
    this.imageList = imageList;

    // Beat timer, x and y blur, millis timer
    this.timer = document.createElement("div");
    this.timer.textContent = "T=$0x0000";

    this.beatCount = document.createElement("div");
    this.beatCount.textContent = "B=$0x000";

    this.xBlur = document.createElement("div");
    this.xBlur.textContent = "X=$0x00";

    this.yBlur = document.createElement("div");
    this.yBlur.textContent = "Y=$0x00";

    // Config stuff
    this.settingsToggle = document.createElement("div");
    this.settingsToggle.innerHTML = '<i class="fa fa-cog"></i>';
    this.settingsToggle.onclick = function() {
        that.core.settings.toggle();
    };

    this.hideToggle = document.createElement("div");
    this.hideToggle.innerHTML = "&#x25BC;";
    this.hideToggle.onclick = function() {
        that.toggleHide();
    };

    this.listContainer = document.createElement("div");
    
    this.resizeHandler = function() {
        that.resize();
    };
};

HuesUI.prototype.connectCore = function(core) {
    this.core = core;
    this.root.style.display = "block";
    this.listContainer.appendChild(core.resourceManager.listView);

    window.addEventListener('resize', this.resizeHandler);
    this.resizeHandler();
};

HuesUI.prototype.disconnect = function() {
    this.core = null;
    this.root.style.display = "none";
    while (this.listContainer.firstElementChild) {
        this.listContainer.removeChild(this.listContainer.firstElementChild);
    }

    window.removeEventListener('resize', this.resizeHandler);
};

// ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
HuesUI.prototype.show = function() {
    this.root.style.display = "block";
};

// ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
HuesUI.prototype.hide = function() {
    this.root.style.display = "none";
};

HuesUI.prototype.toggleHide = function() {
    this.hidden = !this.hidden;
    if(this.hidden) {
        this.root.className = this.constructor.name + " hidden";
    } else {
        this.root.className = this.constructor.name;
    }
};

// May do nothing, may scale elements if needed etc etc
HuesUI.prototype.resize = function() {};
HuesUI.prototype.modeUpdated = function() {};
HuesUI.prototype.beat = function() {};
HuesUI.prototype.updateVolume = function(vol) {};
HuesUI.prototype.invert = function(invert) {};

HuesUI.prototype.setSongText = function() {
    var song = this.core.currentSong;

    if(!song) {
        return;
    }

    this.songLink.textContent = song.title.toUpperCase();
    this.songLink.href = song.source;
};

HuesUI.prototype.setImageText = function() {
    var image = this.core.currentImage;

    if(!image) {
        return;
    }

    var name = image.fullname ? image.fullname : image.name;

    this.imageLink.textContent = name.toUpperCase();
    this.imageLink.href = image.source ? image.source : "";
};

HuesUI.prototype.setColourText = function() {
    var colour = this.core.colours[this.core.colourIndex];

    this.hueName.textContent = colour.n.toUpperCase();
};

HuesUI.prototype.blurUpdated = function(x, y) {
    x = Math.floor(x * 0xFF);
    y = Math.floor(y * 0xFF);
    this.xBlur.textContent = "X=" + this.intToHex2(x);
    this.yBlur.textContent = "Y=" + this.intToHex2(y);
};

HuesUI.prototype.updateTime = function(time) {
    time = Math.floor(time * 1000);
    this.timer.textContent = "T=" + this.intToHex4(time);
};

HuesUI.prototype.intToHex2 = function(num) {
    return '$0x' + ("00"+num.toString(16)).slice(-2);
};

HuesUI.prototype.intToHex3 = function(num) {
    return '$0x' + ("000"+num.toString(16)).slice(-3);
};

HuesUI.prototype.intToHex4 = function(num) {
    return '$0x' + ("0000"+num.toString(16)).slice(-4);
};

/*
 Individual UIs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

function RetroUI() {
    this.container = null;
    this.mode = null;
    this.beatBar = null;
    this.colourIndex = null;
    this.version = null;
    this.imageModeAuto = null;
    this.imageModeAuto = null;
    this.subControls = null;

    HuesUI.call(this);
}

RetroUI.prototype = Object.create(HuesUI.prototype);
RetroUI.prototype.constructor = RetroUI;

RetroUI.prototype.initUI = function() {
    HuesUI.prototype.initUI.call(this);

    var that = this;

    var container = document.createElement("div");
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

    var imageMode = document.createElement("div");
    this.imageModeManual = document.createElement("div");
    this.imageModeManual.textContent = "NORMAL";
    this.imageModeManual.onclick = function() {that.core.setIsFullAuto(false);};
    this.imageModeManual.className = "hues-r-manualmode hues-r-button";
    this.imageModeAuto = document.createElement("div");
    this.imageModeAuto.textContent = "FULL AUTO";
    this.imageModeAuto.onclick = function() {that.core.setIsFullAuto(true);};
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

    var subControl = document.createElement("div");
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
    this.hideRestore.onclick = function() {
        that.toggleHide();
    };
    this.root.appendChild(this.hideRestore);

    this.listContainer.className = "hues-r-listcontainer";
    this.root.appendChild(this.listContainer);
};

RetroUI.prototype.toggleHide = function(stylename) {
    stylename = stylename ? stylename : 'r';
    if(this.hidden) {
        this.subControls.className = "hues-" + stylename + "-subcontrols";
        this.controls.className = "hues-" + stylename + "-controls";
        this.container.className = "hues-r-container";
        this.hideRestore.className = "hues-r-hiderestore";
    } else {
        this.subControls.className = "hues-" + stylename + "-subcontrols hidden";
        this.controls.className = "hues-" + stylename + "-controls hidden";
        this.container.className = "hues-r-container hidden";
        this.hideRestore.className = "hues-r-hiderestore hidden";
    }
    this.hidden = !this.hidden;
};

RetroUI.prototype.connectCore = function(core) {
    HuesUI.prototype.connectCore.call(this, core);

    this.version.textContent = "V=$" + core.version;
    this.modeUpdated();
};

RetroUI.prototype.modeUpdated = function() {
    this.mode.textContent = "M=" + this.core.getCurrentMode();
};

RetroUI.prototype.setImageText = function() {
    var image = this.core.currentImage;

    if(!image) {
        return;
    }

    this.imageLink.textContent = "I=" + image.name.toUpperCase();
    this.imageLink.href = image.source;
};

RetroUI.prototype.setColourText = function(colour) {
    HuesUI.prototype.setColourText.call(this, colour);

    this.colourIndex.textContent = "C=" + this.intToHex2(this.core.colourIndex);
};

RetroUI.prototype.beat = function() {
    var beats = this.core.getBeatString();
    var rest = beats.slice(1);

    this.beatBar.textContent = ">>" + rest;

    this.beatCount.textContent = "B=" + this.intToHex3(this.core.getSafeBeatIndex());
};

function WeedUI() {
    RetroUI.call(this);

    this.xVariance = 10;
    this.yVariance = 20;
}

WeedUI.prototype = Object.create(RetroUI.prototype);
WeedUI.prototype.constructor = WeedUI;

WeedUI.prototype.initUI = function() {
    RetroUI.prototype.initUI.call(this);

    this.container.removeChild(this.beatBar);

    this.controls.className = "hues-w-controls";
    this.subControls.className = "hues-w-subcontrols";

    var beatBar = document.createElement("div");
    beatBar.className = "hues-w-beatbar";
    this.root.appendChild(beatBar);
    this.beatBar = beatBar;

    var beatLeft = document.createElement("div");
    beatLeft.className = "hues-w-beatleft";
    beatBar.appendChild(beatLeft);
    this.beatLeft = beatLeft;

    var beatRight = document.createElement("div");
    beatRight.className = "hues-w-beatright";
    beatBar.appendChild(beatRight);
    this.beatRight = beatRight;

    this.imageModeManual.textContent = "ONE";
    this.imageModeAuto.textContent = "MANY";
};

WeedUI.prototype.toggleHide = function() {
    if(this.hidden) {
        this.beatBar.className = "hues-w-beatbar";
    } else {
        this.beatBar.className = "hues-w-beatbar hidden";
    }
    RetroUI.prototype.toggleHide.call(this, 'w');
};

WeedUI.prototype.beat = function() {
    var beats = this.core.getBeatString();
    var rest = beats.slice(1);

    this.beatLeft.textContent = rest;
    this.beatRight.textContent = rest;

    this.beatCount.textContent = "B=" + this.intToHex3(this.core.getSafeBeatIndex());

    if(["x", "o", "X", "O"].indexOf(beats[0]) != -1) {
        var beatCenter = document.createElement("div");
        beatCenter.className = "hues-w-beataccent";
        var rot = this.round10(15 - Math.random() * 30);
        var x = this.round10(- this.xVariance / 2 + Math.random() * this.xVariance);
        var y = this.round10(30 - this.yVariance / 2 + Math.random() * this.yVariance);
        var transform = "rotate(" + rot + "deg) translate(" + x + "px, " + y + "px)";
        beatCenter.style.MozTransform    = transform;
        beatCenter.style.webkitTransform = transform;
        beatCenter.style.transform       = transform;
        beatCenter.textContent = beats[0].toUpperCase();
        this.root.appendChild(beatCenter);
        window.setTimeout(this.getRemoveBeat(beatCenter), 1500);
    }
};

WeedUI.prototype.round10 = function(num) {
    return Math.round(num * 10) / 10;
};

WeedUI.prototype.getRemoveBeat = function(element) {
    var that = this;
    return function() {
        that.root.removeChild(element);
    };
};

function ModernUI() {
    this.beatBar = null;
    this.beatLeft = null;
    this.beatRight = null;
    this.beatCenter = null;
    this.rightBox = null;
    this.leftBox = null;
    this.rightInfo = null;
    this.leftInfo = null;
    this.controls = null;
    this.volInput = null;
    this.volLabel = null;
    this.hideRestore = null;

    this.currentBeat = ".";

    HuesUI.call(this);

    this.hidden = 0; // we have a 3 stage hide
}

ModernUI.prototype = Object.create(HuesUI.prototype);
ModernUI.prototype.constructor = ModernUI;

ModernUI.prototype.initUI = function() {
    HuesUI.prototype.initUI.call(this);

    var that = this;

    this.imageName.className = "hues-m-imagename";
    this.songName.className = "hues-m-songtitle";

    var controls = document.createElement("div");
    controls.className = "hues-m-controls";
    this.root.appendChild(controls);
    this.controls = controls;

    controls.appendChild(this.imageName);
    controls.appendChild(this.songName);

    var leftBox = document.createElement("div");
    leftBox.className = "hues-m-leftbox";
    controls.appendChild(leftBox);
    this.leftBox = leftBox;

    this.hueName.className = "hues-m-huename";
    leftBox.appendChild(this.hueName);

    var volCluster = document.createElement("div");
    volCluster.className = "hues-m-vol-cluster";
    leftBox.appendChild(volCluster);

    this.settingsToggle.className = "hues-m-cog";
    volCluster.appendChild(this.settingsToggle);

    this.hideToggle.className = "hues-m-hide";
    volCluster.appendChild(this.hideToggle);

    var volBar = document.createElement("div");
    volBar.className = "hues-m-vol-bar";
    this.volBar = volBar;
    volCluster.appendChild(volBar);

    var label = document.createElement("div");
    label.textContent = "VOL";
    label.className = "hues-m-vol-label";
    label.onclick = function() {
        that.core.soundManager.toggleMute();
    };
    volBar.appendChild(label);
    this.volLabel = label;

    this.infoToggle = document.createElement("div");
    this.infoToggle.innerHTML = '?';
    this.infoToggle.className = "hues-m-question";
    this.infoToggle.onclick = function() {
        that.core.settings.showInfo();
    };
    volCluster.appendChild(this.infoToggle);

    var input = document.createElement("input");
    input.type = "range";
    input.min = 0;
    input.max = 1;
    input.step = 0.1;
    volBar.appendChild(input);
    this.volInput = input;
    input.oninput = function() {
        that.core.soundManager.setVolume(parseFloat(input.value));
    };

    var rightBox = document.createElement("div");
    rightBox.className = "hues-m-rightbox";
    controls.appendChild(rightBox);
    this.rightBox = rightBox;

    //Song/image controls
    var songs = document.createElement("div");
    songs.className = "hues-m-controlblock";
    this.songBlock = songs;
    this.songList.className = "hues-m-songbutton";

    var songControls = document.createElement("div");
    songControls.className = "hues-m-controlbuttons";
    this.songPrev.className = "hues-m-prevbutton";
    this.songNext.className = "hues-m-nextbutton";
    this.songShuffle = document.createElement("div");
    this.songShuffle.innerHTML = '<i class="fa fa-random"></i>';
    this.songShuffle.className = "hues-m-actbutton";
    this.songShuffle.onclick = function() {that.core.randomSong();};
    songs.appendChild(this.songList);
    songControls.appendChild(this.songPrev);
    songControls.appendChild(this.songShuffle);
    songControls.appendChild(this.songNext);
    songs.appendChild(songControls);
    rightBox.appendChild(songs);

    var images = document.createElement("div");
    images.className = "hues-m-controlblock";
    this.imageList.className = "hues-m-songbutton";
    this.imageBlock = images;

    var imageControls = document.createElement("div");
    imageControls.className = "hues-m-controlbuttons";

    this.imageMode = document.createElement("div");
    this.imageMode.innerHTML = "&#9654;"; // PLAY
    this.imageMode.className = "hues-m-actbutton";
    this.imageMode.onclick = function() {that.core.toggleFullAuto();};
    this.imagePrev.className = "hues-m-prevbutton";
    this.imageNext.className = "hues-m-nextbutton";
    images.appendChild(this.imageList);
    imageControls.appendChild(this.imagePrev);
    imageControls.appendChild(this.imageMode);
    imageControls.appendChild(this.imageNext);
    images.appendChild(imageControls);
    rightBox.appendChild(images);

    var leftInfo = document.createElement("div");
    leftInfo.className = "hues-m-leftinfo";
    var rightInfo = document.createElement("div");
    rightInfo.className = "hues-m-rightinfo";
    leftInfo.appendChild(this.xBlur);
    leftInfo.appendChild(this.yBlur);
    rightInfo.appendChild(this.timer);
    rightInfo.appendChild(this.beatCount);
    this.rightInfo = rightInfo;
    this.leftInfo = leftInfo;
    controls.appendChild(leftInfo);
    controls.appendChild(rightInfo);
    
    var beatBar = document.createElement("div");
    beatBar.className = "hues-m-beatbar";
    this.root.appendChild(beatBar);
    this.beatBar = beatBar;

    var beatLeft = document.createElement("div");
    beatLeft.className = "hues-m-beatleft";
    beatBar.appendChild(beatLeft);
    this.beatLeft = beatLeft;

    var beatRight = document.createElement("div");
    beatRight.className = "hues-m-beatright";
    beatBar.appendChild(beatRight);
    this.beatRight = beatRight;

    var beatCenter = document.createElement("div");
    beatCenter.className = "hues-m-beatcenter";
    this.root.appendChild(beatCenter);
    this.beatCenter = beatCenter;

    this.hideRestore = document.createElement("div");
    this.hideRestore.className = "hues-m-hiderestore";
    this.hideRestore.onclick = function() {
        that.toggleHide();
    };
    this.root.appendChild(this.hideRestore);

    this.listContainer.className = "hues-m-listcontainer";
    this.root.appendChild(this.listContainer);
};

ModernUI.prototype.toggleHide = function() {
    // classList is new-ish, but if you have web audio you'll have this
    this.beatBar.classList.remove("hidden");
    this.beatCenter.classList.remove("hidden");
    this.controls.classList.remove("hidden");
    this.hideRestore.classList.remove("hidden");
    switch(this.hidden) {
        case 1:
            this.beatBar.classList.add("hidden");
            this.beatCenter.classList.add("hidden");
            /* falls through */
        case 0:
            this.controls.classList.add("hidden");
            this.hideRestore.classList.add("hidden");
    }
    this.hidden = (this.hidden+1) % 3;
};

ModernUI.prototype.updateVolume = function(vol) {
    this.volInput.value = vol;
    if(vol === 0) {
        this.volLabel.textContent = "(VOL)";
    } else {
        this.volLabel.textContent = "VOL";
    }
};

ModernUI.prototype.modeUpdated = function() {
    if(this.core.isFullAuto) {
        this.imageMode.innerHTML = '<i class="fa fa-pause"></i>'; // PAUSE;
    } else {
        this.imageMode.innerHTML = "&#9654;"; // PLAY
    }
};

ModernUI.prototype.beat = function() {
    var beats = this.core.getBeatString();

    this.currentBeat = beats[0];
    var rest = beats.slice(1);

    this.beatLeft.textContent = rest;
    this.beatRight.textContent = rest;


    if (this.currentBeat != ".") {
        while (this.beatCenter.firstElementChild) {
            this.beatCenter.removeChild(this.beatCenter.firstElementChild);
        }
        var span = this.beatCenter.ownerDocument.createElement("span");
        span.textContent = this.currentBeat;
        this.beatCenter.appendChild(span);
    }
    this.beatCount.textContent = "B=" + this.intToHex4(this.core.getSafeBeatIndex());
};

ModernUI.prototype.resize = function() {
    HuesUI.prototype.resize.call(this);
    this.resizeSong();
    this.resizeImage();
};

ModernUI.prototype.resizeElement = function(el, parent) {
    el.className = "";
    if (el.offsetWidth > parent.clientWidth) {
        el.className = "small";
    }
    if (el.offsetWidth > parent.clientWidth) {
        el.className = "x-small";
    }
};

ModernUI.prototype.resizeSong = function() {
    this.resizeElement(this.songLink, this.songName);
};

ModernUI.prototype.resizeImage = function() {
    this.resizeElement(this.imageLink, this.imageName);
};

ModernUI.prototype.setSongText = function() {
    HuesUI.prototype.setSongText.call(this);

    if(!this.core.currentSong) {
        return;
    }

    this.resizeSong();
};

ModernUI.prototype.setImageText = function() {
    HuesUI.prototype.setImageText.call(this);

    if(!this.core.currentImage) {
        return;
    }

    this.resizeImage();
};

function XmasUI() {
    ModernUI.call(this);

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

    var wires = document.createElement("div");
    wires.className = "hues-x-wires";

    var left = document.createElement("div");
    left.className = "hues-x-wiresleft";
    xleft.forEach(function(l, i, a) {
        var light = this.newLight(l, left);
        light.style.transform = "rotate(" + l.angle + "deg)";
        light.style.left = l.x + "px";
        light.style.top = l.y + "px";
        this.lights.push(light);
    }, this);

    var right = document.createElement("div");
    right.className = "hues-x-wiresright";
    xright.forEach(function(l, i, a) {
        var light = this.newLight(l, right);
        light.style.transform = "rotate(" + (-l.angle) + "deg)";
        light.style.right = l.x + "px";
        light.style.top = l.y + "px";
        this.lights.push(light);
    }, this);

    var bottomHelper = document.createElement("div");
    bottomHelper.className = "hues-x-wiresbottomhelper";
    var bottom = document.createElement("div");
    bottom.className = "hues-x-wiresbottom";
    xbottom.forEach(function(l, i, a) {
        var light = this.newLight(l, bottom);
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
}

XmasUI.prototype = Object.create(ModernUI.prototype);
XmasUI.prototype.constructor = XmasUI;

XmasUI.prototype.connectCore = function(core) {
    HuesUI.prototype.connectCore.call(this, core);
    this.core.renderer.startSnow();
};

XmasUI.prototype.disconnect = function() {
    this.core.renderer.stopSnow();
    HuesUI.prototype.disconnect.call(this);
};

XmasUI.prototype.lightOn = function(light) {
    light.on.className = "hues-x-lighton";
    light.off.className = "hues-x-lightoff";
};

XmasUI.prototype.lightOff = function(light) {
    light.on.className = "hues-x-lighton off";
    light.off.className = "hues-x-lightoff off";
};

XmasUI.prototype.lightFadeOut = function(light) {
    light.on.className = "hues-x-lighton hues-x-fade off";
    light.off.className = "hues-x-lightoff hues-x-fade off";
};

XmasUI.prototype.lightRecolour = function(light) {
    var hue = Math.random() * 360;
    light.bulb.style.filter = "hue-rotate(" + hue + "deg)";
    light.bulb.style.webkitFilter = "hue-rotate(" + hue + "deg)";
};

XmasUI.prototype.randomLight = function(light) {
    if(Math.random() >= 0.5) {
        this.lightOn(light);
    } else {
        this.lightOff(light);
    }
};

XmasUI.prototype.newLight = function(l, parent) {
    var light = document.createElement("div");
    light.className = "hues-x-light";
    var bulb = document.createElement("div");
    var on = document.createElement("img");
    on.src = "./img/lighton.png";
    var off = document.createElement("img");
    off.src = "./img/lightoff.png";
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
};

XmasUI.prototype.beat = function() {
    ModernUI.prototype.beat.call(this);
    if(this.currentBeat != ".") {
        this.lights.forEach(function(light, i, a) {
            switch(this.currentBeat) {
                case ": ": 
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
};

XmasUI.prototype.setColourText = function(colour) {};
XmasUI.prototype.blurUpdated = function(x, y) {};
XmasUI.prototype.updateTime = function(time) {};

function HalloweenUI() {
    ModernUI.call(this);
}

HalloweenUI.prototype = Object.create(ModernUI.prototype);
HalloweenUI.prototype.constructor = HalloweenUI;

HalloweenUI.prototype.initUI = function() {
    ModernUI.prototype.initUI.call(this);
    
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
    
    var leftBoxTomb = document.createElement("div");
    leftBoxTomb.className = "hues-h-tombstone";
    this.leftBox.appendChild(leftBoxTomb);
    
    var songTomb = document.createElement("div");
    songTomb.className = "hues-h-tombstone";
    this.songBlock.insertBefore(songTomb,this.songBlock.firstChild);
    
    var imageTomb = document.createElement("div");
    imageTomb.className = "hues-h-tombstone";
    this.imageBlock.insertBefore(imageTomb,this.imageBlock.firstChild);
    
    var topLeft = document.createElement("div");
    topLeft.className = "hues-h-topleft";
    var topRight = document.createElement("div");
    topRight.className = "hues-h-topright";
    var bottomRight = document.createElement("div");
    bottomRight.className = "hues-h-bottomright";
    
    this.root.appendChild(topLeft);
    this.root.appendChild(topRight);
    this.root.appendChild(bottomRight);
    
    var leftHand = document.createElement("div");
    leftHand.className = "hues-h-left-hand";
    this.beatBar.appendChild(leftHand);
    var rightHand = document.createElement("div");
    rightHand.className = "hues-h-right-hand";
    this.beatBar.appendChild(rightHand);
    
    this.vignette = document.createElement("div");
    this.vignette.className = "hues-h-vignette";
    this.root.appendChild(this.vignette);
}

HalloweenUI.prototype.beat = function() {
    ModernUI.prototype.beat.call(this);
    
    if (this.currentBeat != ".") {
        var eyes = this.beatCenter.ownerDocument.createElement("div");
        eyes.className = "hues-m-beatcenter hues-h-eyes";
        this.beatCenter.appendChild(eyes);
    }
}

HalloweenUI.prototype.invert = function(invert) {
    if(invert) {
        this.vignette.style.filter = "invert(100%)";
        this.vignette.style.webkitFilter = "invert(100%)";
    } else {
        this.vignette.style.filter = "";
        this.vignette.style.webkitFilter = "";
    }
};

HalloweenUI.prototype.connectCore = function(core) {
    ModernUI.prototype.connectCore.call(this, core);
    
    document.getElementById("preloadHelper").classList.add("hues-h-text");
}

HalloweenUI.prototype.disconnect = function() {
    ModernUI.prototype.disconnect.call(this, core);
    
    document.getElementById("preloadHelper").classList.remove("hues-h-text");
};

// Positions and angles for the Xmas lights
var xleft = [
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
var xright = [
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
var xbottom = [
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