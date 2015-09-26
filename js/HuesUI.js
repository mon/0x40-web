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
    songList.onclick = function() {that.core.toggleSongList()};
    this.songList = songList;
    var imageList = document.createElement("div");
    imageList.textContent = "IMAGES";
    imageList.onclick = function() {that.core.toggleImageList()};
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
    }
    
    this.hideToggle = document.createElement("div");
    this.hideToggle.innerHTML = "&#x25BC;";
    this.hideToggle.onclick = function() {
        that.toggleHide();
    }
    
    this.listContainer = document.createElement("div");
}

HuesUI.prototype.connectCore = function(core) {
    this.core = core;
    this.root.style.display = "block";
    this.listContainer.appendChild(core.resourceManager.listView);
}

HuesUI.prototype.disconnect = function() {
    this.core = null;
    this.root.style.display = "none";
    while (this.listContainer.firstElementChild) {
        this.listContainer.removeChild(this.listContainer.firstElementChild);
    }
}

// ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
HuesUI.prototype.show = function() {
    this.root.style.display = "block";
}

// ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
HuesUI.prototype.hide = function() {
    this.root.style.display = "none";
}

HuesUI.prototype.toggleHide = function() {
    this.hidden = !this.hidden;
    if(this.hidden) {
        this.root.className = this.constructor.name + " hidden";
    } else {
        this.root.className = this.constructor.name;
    }
}

// May do nothing, may scale elements if needed etc etc
HuesUI.prototype.resize = function() {}
HuesUI.prototype.modeUpdated = function() {}
HuesUI.prototype.beat = function() {}
HuesUI.prototype.updateVolume = function(vol) {}

HuesUI.prototype.setSongText = function() {
    var song = this.core.currentSong;
    
    if(!song)
        return;
    
    this.songLink.textContent = song.title.toUpperCase();
    this.songLink.href = song.source;
}

HuesUI.prototype.setImageText = function() {
    var image = this.core.currentImage;
    
    if(!image)
        return;
    
    var name = image.fullname ? image.fullname : image.name;

    this.imageLink.textContent = name.toUpperCase();
    this.imageLink.href = image.source ? image.source : "";
}

HuesUI.prototype.setColourText = function(colour) {
    var colour = this.core.colours[this.core.colourIndex];
    
    this.hueName.textContent = colour.n.toUpperCase();
}

HuesUI.prototype.blurUpdated = function(x, y) {
    x = Math.floor(x * 0xFF);
    y = Math.floor(y * 0xFF);;
    this.xBlur.textContent = "X=" + this.intToHex2(x);
    this.yBlur.textContent = "Y=" + this.intToHex2(y);
}

HuesUI.prototype.updateTime = function(time) {
    time = Math.floor(time * 1000);
    this.timer.textContent = "T=" + this.intToHex4(time);
}

HuesUI.prototype.intToHex2 = function(num) {
    return '$0x' + ("00"+num.toString(16)).slice(-2);
}

HuesUI.prototype.intToHex3 = function(num) {
    return '$0x' + ("000"+num.toString(16)).slice(-3);
}

HuesUI.prototype.intToHex4 = function(num) {
    return '$0x' + ("0000"+num.toString(16)).slice(-4);
}

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
    }
    this.root.appendChild(this.hideRestore);
    
    this.listContainer.className = "hues-r-listcontainer";
    this.root.appendChild(this.listContainer);
}

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
}

RetroUI.prototype.connectCore = function(core) {
    HuesUI.prototype.connectCore.call(this, core);
    
    this.version.textContent = "V=$" + core.version;
    this.modeUpdated();
}

RetroUI.prototype.modeUpdated = function() {
    this.mode.textContent = "M=" + this.core.getCurrentMode();
}

RetroUI.prototype.setImageText = function() {
    var image = this.core.currentImage;
    
    if(!image)
        return;

    this.imageLink.textContent = "I=" + image.name.toUpperCase();
    this.imageLink.href = image.source;
}

RetroUI.prototype.setColourText = function(colour) {
    HuesUI.prototype.setColourText.call(this, colour);
    
    this.colourIndex.textContent = "C=" + this.intToHex2(this.core.colourIndex);
}

RetroUI.prototype.beat = function() {
    var beats = this.core.getBeatString();
    var rest = beats.slice(1);

    this.beatBar.textContent = ">>" + rest;
    
    this.beatCount.textContent = "B=" + this.intToHex3(this.core.getSafeBeatIndex());
}

function WeedUI() {
    RetroUI.call(this);
    
    this.xVariance = 10;
    this.yVariance = 20;
}
WeedUI.prototype = Object.create(RetroUI.prototype);
WeedUI.prototype.constructor = WeedUI;

WeedUI.prototype.initUI = function() {
    RetroUI.prototype.initUI.call(this);
    
    this.container.removeChild(this.beatBar)
    
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
}

WeedUI.prototype.toggleHide = function() {
    if(this.hidden) {
        this.beatBar.className = "hues-w-beatbar";
    } else {
        this.beatBar.className = "hues-w-beatbar hidden";
    }
    RetroUI.prototype.toggleHide.call(this, 'w');
}

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
        var transform = "rotate(" + rot + "deg) translate(" + x + "px," + y + "px)";
        beatCenter.style.MozTransform    = transform;
        beatCenter.style.webkitTransform = transform;
        beatCenter.style.transform       = transform;
        beatCenter.textContent = beats[0].toUpperCase();
        this.root.appendChild(beatCenter);
        window.setTimeout(this.getRemoveBeat(beatCenter), 1500);
    }
}

WeedUI.prototype.round10 = function(num) {
    return Math.round(num * 10) / 10;
}

WeedUI.prototype.getRemoveBeat = function(element) {
    var that = this;
    return function() {
        that.root.removeChild(element);
    };
}

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
    volCluster.appendChild(volBar);

    var label = document.createElement("div");
    label.textContent = "VOL";
    label.className = "hues-m-vol-label";
    label.onclick = function() {
        that.core.soundManager.toggleMute()
    };
    volBar.appendChild(label);
    this.volLabel = label;
    
    var infoToggle = document.createElement("div");
    infoToggle.innerHTML = '?';
    infoToggle.className = "hues-m-question";
    infoToggle.onclick = function() {
        that.core.settings.showInfo();
    }
    volCluster.appendChild(infoToggle);

    var input = document.createElement("input");
    input.type = "range";
    input.min = 0;
    input.max = 1;
    input.step = 0.1;
    volBar.appendChild(input);
    this.volInput = input;
    input.oninput = function() {
        that.core.soundManager.setVolume(parseFloat(input.value));
    }
    
    var rightBox = document.createElement("div");
    rightBox.className = "hues-m-rightbox";
    controls.appendChild(rightBox);
    this.rightBox = rightBox;
    
    //Song/image controls
    var songs = document.createElement("div");
    songs.className = "hues-m-controlblock";
    this.songList.className = "hues-m-songbutton";
    
    var songControls = document.createElement("div");
    songControls.className = "hues-m-controlbuttons";
    this.songPrev.className = "hues-m-prevbutton"
    this.songNext.className = "hues-m-nextbutton"
    var songShuffle = document.createElement("div");
    songShuffle.innerHTML = '<i class="fa fa-random"></i>';
    songShuffle.className = "hues-m-actbutton";
    songShuffle.onclick = function() {that.core.randomSong();};
    songs.appendChild(this.songList);
    songControls.appendChild(this.songPrev);
    songControls.appendChild(songShuffle);
    songControls.appendChild(this.songNext);
    songs.appendChild(songControls);
    rightBox.appendChild(songs);
    
    var images = document.createElement("div");
    images.className = "hues-m-controlblock";
    this.imageList.className = "hues-m-songbutton";
    
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
    this.rightInfo = rightInfo
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
    }
    this.root.appendChild(this.hideRestore);
    
    this.listContainer.className = "hues-m-listcontainer";
    this.root.appendChild(this.listContainer);
}

ModernUI.prototype.toggleHide = function() {
    this.beatBar.className = "hues-m-beatbar";
    this.beatCenter.className = "hues-m-beatcenter";
    this.controls.className = "hues-m-controls";
    this.hideRestore.className = "hues-m-hiderestore";
    switch(this.hidden) {
        case 1:
            this.beatBar.className = "hues-m-beatbar hidden";
            this.beatCenter.className = "hues-m-beatcenter hidden";
        case 0:
            this.controls.className = "hues-m-controls hidden";
            this.hideRestore.className = "hues-m-hiderestore hidden";
    }
    this.hidden = (this.hidden+1) % 3;
}

ModernUI.prototype.updateVolume = function(vol) {
    this.volInput.value = vol;
    if(vol == 0) {
        this.volLabel.textContent = "(VOL)";
    } else {
        this.volLabel.textContent = "VOL";
    };
}

ModernUI.prototype.modeUpdated = function() {
    if(this.core.isFullAuto) {
        this.imageMode.innerHTML = '<i class="fa fa-pause"></i>'; // PAUSE;
    } else {
        this.imageMode.innerHTML = "&#9654;"; // PLAY
    }
}

ModernUI.prototype.beat = function() {
    var beats = this.core.getBeatString();

    var current = beats[0];
    var rest = beats.slice(1);

    this.beatLeft.textContent = rest;
    this.beatRight.textContent = rest;


    if (current != ".") {
        while (this.beatCenter.firstElementChild) {
            this.beatCenter.removeChild(this.beatCenter.firstElementChild);
        }
        var span = this.beatCenter.ownerDocument.createElement("span");
        span.textContent = current;
        this.beatCenter.appendChild(span);
    }
    this.beatCount.textContent = "B=" + this.intToHex4(this.core.getSafeBeatIndex());
}

ModernUI.prototype.setSongText = function() {
    HuesUI.prototype.setSongText.call(this);
    
    if(!this.core.currentSong)
        return;
    
    var name = this.songName;

    name.className = "hues-m-songtitle"
    if (name.offsetWidth > name.clientWidth) {
        name.className = "hues-m-songtitle small"
    }
    if (name.offsetWidth > name.clientWidth) {
        name.className = "hues-m-songtitle x-small"
    }
}

ModernUI.prototype.setImageText = function() {
    HuesUI.prototype.setImageText.call(this);
    
    if(!this.core.currentImage)
        return;
    
    var name = this.imageName

    name.className = "hues-m-imagename"
    if (name.offsetWidth > name.clientWidth) {
        name.className = "hues-m-imagename small"
    }
    if (name.offsetWidth > name.clientWidth) {
        name.className = "hues-m-imagename x-small"
    }
}

function XmasUI() {
    ModernUI.call(this);
    
    this.controls.removeChild(this.leftBox);
    this.controls.removeChild(this.rightBox);
    this.controls.removeChild(this.rightInfo);
    this.controls.removeChild(this.leftInfo);
    
    this.leftBox = this.rightBox = this.hueName = this.xBlur = this.yBlur 
        = this.timer = null;
    
    this.controls.className = "hues-x-controls";
    this.beatBar.className = "hues-x-beatbar";
}
XmasUI.prototype = Object.create(ModernUI.prototype);
XmasUI.prototype.constructor = XmasUI;

XmasUI.prototype.toggleHide = function() {
    this.beatBar.className = "hues-x-beatbar";
    this.beatCenter.className = "hues-m-beatcenter";
    this.controls.className = "hues-x-controls";
    switch(this.hidden) {
        case 1:
            this.beatBar.className = "hues-x-beatbar hidden";
            this.beatCenter.className = "hues-m-beatcenter hidden";
        case 0:
            this.controls.className = "hues-x-controls hidden";
    }
    this.hidden = (this.hidden+1) % 3;
}

XmasUI.prototype.setColourText = function(colour) {};
XmasUI.prototype.blurUpdated = function(x, y) {};
XmasUI.prototype.updateTime = function(time) {};