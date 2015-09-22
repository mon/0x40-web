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
    
    this.volInput = null;
    this.volLabel = null;
    
    this.initUI();
}

HuesUI.prototype.initUI = function() {
    var doc = this.root.ownerDocument

    var imageName = doc.createElement("div");
    this.imageName = imageName;
    
    this.imageLink = doc.createElement("a");
    this.imageLink.target = "_blank";
    this.imageName.appendChild(this.imageLink);

    var songName = doc.createElement("div");
    this.songName = songName;
    
    this.songLink = doc.createElement("a");
    this.songLink.target = "_blank";
    this.songName.appendChild(this.songLink);

    var hueName = doc.createElement("div");
    this.hueName = hueName;

    //this.setupVolume(leftBox)
}

HuesUI.prototype.connectCore = function(core) {
    this.core = core;
    this.root.style.display = "block";
}

HuesUI.prototype.disconnect = function() {
    this.core = null;
    this.root.style.display = "none";
}

HuesUI.prototype.show = function() {
    this.root.style.display = "block";
}

HuesUI.prototype.hide = function() {
    this.root.style.display = "none";
}

// May do nothing, may scale elements if needed etc etc
HuesUI.prototype.resize = function() {}
HuesUI.prototype.modeUpdated = function() {}
HuesUI.prototype.beat = function() {}
HuesUI.prototype.updateTime = function() {}
HuesUI.prototype.blurUpdated = function(x, y) {}

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

    this.imageLink.textContent = image.fullname.toUpperCase();
    this.imageLink.href = image.source;
}

HuesUI.prototype.setColourText = function(colour) {
    var colour = this.core.colours[this.core.colourIndex];
    
    this.hueName.textContent = colour.n.toUpperCase();
}

HuesUI.prototype.updateLists = function() {
    var songs = this.core.resourceManager.enabledSongs;
    var images = this.core.resourceManager.enabledImages;
    // TODO display this
}

HuesUI.prototype.updateTexts = function() {
    // Timer, beat counter
}

/*
 Individual UIs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

function RetroUI() {
    this.container = null;
    this.mode = null;
    this.beatBar = null;
    this.beatCount = null;
    this.timer = null;
    this.colourIndex = null;
    this.version = null;
    HuesUI.call(this);
}
RetroUI.prototype = Object.create(HuesUI.prototype);
RetroUI.prototype.constructor = RetroUI;

RetroUI.prototype.initUI = function() {
    HuesUI.prototype.initUI.call(this);
    
    var doc = this.root.ownerDocument;
    
    var container = doc.createElement("div");
    container.className = "hues-r-container";
    this.root.appendChild(container);
    this.container = container;
    
    this.mode = doc.createElement("div");
    container.appendChild(this.mode);
    container.appendChild(this.imageName);
    
    this.timer = doc.createElement("div");
    this.timer.textContent = "T=$0x0000";
    container.appendChild(this.timer);
    
    this.beatCount = doc.createElement("div");
    this.beatCount.textContent = "B=$0x00";
    container.appendChild(this.beatCount);
    
    this.xBlur = doc.createElement("div");
    this.xBlur.textContent = "X=$0x00";
    container.appendChild(this.xBlur);
    
    this.yBlur = doc.createElement("div");
    this.yBlur.textContent = "Y=$0x00";
    container.appendChild(this.yBlur);
    
    this.colourIndex = doc.createElement("div");
    this.colourIndex.textContent = "C=$0x00";
    container.appendChild(this.colourIndex);
    
    this.version = doc.createElement("div");
    container.appendChild(this.version);
    
    container.appendChild(this.hueName);
    container.appendChild(this.songName);
    
    this.beatBar = doc.createElement("div");
    container.appendChild(this.beatBar);
}

RetroUI.prototype.connectCore = function(core) {
    HuesUI.prototype.connectCore.call(this, core);
    
    this.version.textContent = "V=$" + core.version;
    this.modeUpdated();
}

RetroUI.prototype.modeUpdated = function() {
    this.mode.textContent = "M=" + this.core.getCurrentMode();
}

RetroUI.prototype.blurUpdated = function(x, y) {
    x = Math.floor(x * 0xFF);
    y = Math.floor(y * 0xFF);;
    this.xBlur.textContent = "X=" + this.intToHex2(x);
    this.yBlur.textContent = "Y=" + this.intToHex2(y);
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
    
    this.beatCount.textContent = "B=" + this.intToHex2(this.core.getSafeBeatIndex());
}

RetroUI.prototype.updateTime = function(time) {
    time = Math.floor(time * 1000);
    this.timer.textContent = "T=" + this.intToHex4(time);
}

RetroUI.prototype.intToHex2 = function(num) {
    return '$0x' + ("00"+num.toString(16)).slice(-2);
}
RetroUI.prototype.intToHex4 = function(num) {
    return '$0x' + ("0000"+num.toString(16)).slice(-4);
}

function ModernUI() {
    this.beatBar = null;
    this.beatLeft = null;
    this.beatRight = null;
    this.beatCenter = null;
    this.rightBox = null;
    this.leftBox = null;
    this.controls = null;
    
    HuesUI.call(this);
}
ModernUI.prototype = Object.create(HuesUI.prototype);
ModernUI.prototype.constructor = ModernUI;

ModernUI.prototype.initUI = function() {
    HuesUI.prototype.initUI.call(this);
    
    var doc = this.root.ownerDocument;
    
    this.imageName.className = "hues-m-imagename";
    this.songName.className = "hues-m-songtitle";
    
    var controls = doc.createElement("div");
    controls.className = "hues-m-controls";
    this.root.appendChild(controls);
    this.controls = controls;
    
    controls.appendChild(this.imageName);
    controls.appendChild(this.songName);

    var leftBox = doc.createElement("div");
    leftBox.className = "hues-m-leftbox";
    controls.appendChild(leftBox);
    this.leftBox = leftBox;
    
    this.hueName.className = "hues-m-huename";
    leftBox.appendChild(this.hueName);
    
    var rightBox = doc.createElement("div");
    rightBox.className = "hues-m-rightbox";
    controls.appendChild(rightBox);
    this.rightBox = rightBox;

    var beatBar = doc.createElement("div");
    beatBar.className = "hues-m-beatbar";
    this.root.appendChild(beatBar);
    this.beatBar = beatBar;

    var beatLeft = doc.createElement("div");
    beatLeft.className = "hues-m-beatleft";
    beatBar.appendChild(beatLeft);
    this.beatLeft = beatLeft;

    var beatRight = doc.createElement("div");
    beatRight.className = "hues-m-beatright";
    beatBar.appendChild(beatRight);
    this.beatRight = beatRight;
    
    var beatCenter = doc.createElement("div");
    beatCenter.className = "hues-m-beatcenter";
    this.root.appendChild(beatCenter);
    this.beatCenter = beatCenter;
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
    var doc = this.root.ownerDocument;
    
    var beatBar = doc.createElement("div");
    beatBar.className = "hues-w-beatbar";
    this.root.appendChild(beatBar);
    this.beatBar = beatBar;

    var beatLeft = doc.createElement("div");
    beatLeft.className = "hues-w-beatleft";
    beatBar.appendChild(beatLeft);
    this.beatLeft = beatLeft;

    var beatRight = doc.createElement("div");
    beatRight.className = "hues-w-beatright";
    beatBar.appendChild(beatRight);
    this.beatRight = beatRight;
}

WeedUI.prototype.beat = function() {
    var beats = this.core.getBeatString();
    var rest = beats.slice(1);

    this.beatLeft.textContent = rest;
    this.beatRight.textContent = rest;
    
    this.beatCount.textContent = "B=" + this.intToHex2(this.core.getSafeBeatIndex());
    
    if(["x", "o", "X", "O"].indexOf(beats[0]) != -1) {
        var doc = this.root.ownerDocument;
        var beatCenter = doc.createElement("div");
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

function XmasUI() {
    ModernUI.call(this);
    
    this.controls.removeChild(this.leftBox);
    this.controls.removeChild(this.rightBox);
    
    this.leftBox = this.rightBox = this.hueName = null;
    
    this.controls.className = "hues-x-controls";
    this.beatBar.className = "hues-x-beatbar";
}
XmasUI.prototype = Object.create(ModernUI.prototype);
XmasUI.prototype.constructor = XmasUI;

XmasUI.prototype.setColourText = function(colour) {};