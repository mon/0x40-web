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

// NOTE: Any packs referenced need CORS enabled or loads fail
var packsURL = "http://cdn.0x40hu.es/getRespacks.php";

function Resources(core) {
    this.core = core;
    
    this.resourcePacks = [];

    this.allSongs = [];
    this.allImages = [];
    this.enabledSongs = [];
    this.enabledImages = [];
    
    this.toLoad = 0;
    this.progressState = [];
    this.rToLoad = []
    this.loadFinishCallback = null;
    this.progressCallback = null;
    
    this.root = null;
    // For songs/images
    this.listView = null;
    this.enabledSongList = null;
    this.enabledImageList = null;
    this.packView = {
        pack: null,
        name: null,
        creator: null,
        size: null,
        desc: null,
        songCount: null,
        imageCount: null,
        songList: null,
        imageList: null,
        packButtons: null,
        totalSongs: null,
        totalImages: null
    };
    this.packsView = {
        respackList: null,
        remoteList: null,
        loadRemote: null,
        progressBar: null,
        progressStatus: null,
        progressCurrent: null,
        progressTop: null,
        progressPercent: null
    };
    this.remotes = null;
    this.fileInput = null;
    this.fileParseQueue = [];
    this.currentlyParsing = false;
    this.initUI();
}

// Array of URLs to load, and a callback for when we're done
// Preserves order of URLs being loaded
Resources.prototype.addAll = function(urls, callback, progressCallback) {
    var that = this;
    this.toLoad += urls.length;
    if(progressCallback) {
        this.progressCallback = progressCallback;
        this.progressState = Array.apply(null, Array(urls.length)).map(Number.prototype.valueOf,0);
    }
    if(callback) {
        this.loadFinishCallback = callback;
    }
    for(var i = 0; i < urls.length; i++) {
        var r = new Respack();
        this.rToLoad.push(r);
        r.loadFromURL(urls[i], function() {
            that.toLoad--;
            if(that.toLoad <= 0) {
                // could use a while() and shift(), but it'd be slower
                for(var i = 0; i < that.rToLoad.length; i++) {
                    that.addPack(that.rToLoad[i]);
                }
                that.rToLoad = [];
                if(that.loadFinishCallback) {
                    that.loadFinishCallback();
                    that.loadFinishCallback = null;
                }
                that.progressCallback = null;
            }
        }, this.createProgCallback(i));
    }
}

Resources.prototype.createProgCallback = function(i) {
    var that = this;
    return function(progress, pack) {
        that.progressState[i] = progress;
        that.updateProgress(pack);
    }
}

Resources.prototype.updateProgress = function(pack) {
    var total = 0;
    for(var i = 0; i < this.progressState.length; i++) {
        total += this.progressState[i];
    }
    total /= this.progressState.length;
    this.progressCallback(total, pack);
}

Resources.prototype.addPack = function(pack) {
    console.log("Added", pack.name, "to respacks");
    var that = this;
    var id = this.resourcePacks.length;
    this.resourcePacks.push(pack);
    this.addResourcesToArrays(pack);
    this.rebuildEnabled();
    this.updateTotals();
    
    this.appendListItem("respacks", pack.name, "res" + id, this.packsView.respackList,
        function() {
            pack.enabled = this.checked;
            that.rebuildEnabled();
        }, 
        this.selectPackCallback(id)
    );
}

Resources.prototype.addResourcesToArrays = function(pack) {
    this.allImages = this.allImages.concat(pack.images);
    this.allSongs = this.allSongs.concat(pack.songs);
}

Resources.prototype.rebuildArrays = function() {
    this.allSongs = [];
    this.allImages = [];
    this.allAnimations = [];
    
    for(var i = 0; i < this.resourcePacks.length; i++) {
        this.addResourcesToArrays(this.resourcePacks[i]);
    }
}

Resources.prototype.rebuildEnabled = function() {
    this.enabledSongs = [];
    this.enabledImages = [];

    for(var i = 0; i < this.resourcePacks.length; i++) {
        var pack = this.resourcePacks[i];
        if (pack["enabled"] != true) {
            continue;
        }
        for(var j = 0; j < pack.songs.length; j++) {
            var song = pack.songs[j];
            if (song.enabled && this.enabledSongs.indexOf(song) == -1) {
                this.enabledSongs.push(song);
            }
        }
        for(var j = 0; j < pack.images.length; j++) {
            var image = pack.images[j];
            if (image.enabled && this.enabledImages.indexOf(image) == -1) {
               this.enabledImages.push(image);
            }
        }
    }
    
    var songList = this.enabledSongList;
    while(songList.firstElementChild) {
        songList.removeChild(songList.firstElementChild)
    }    
    var imageList = this.enabledImageList;
    while(imageList.firstElementChild) {
        imageList.removeChild(imageList.firstElementChild)
    }
    for(var i = 0; i < this.enabledSongs.length; i++) {
        var song = this.enabledSongs[i];
        this.appendSimpleListItem(song.title, songList, this.playSongCallback(i));
    }
    for(var i = 0; i < this.enabledImages.length; i++) {
        var image = this.enabledImages[i];
        this.appendSimpleListItem(image.name, imageList, this.selectImageCallback(i));
    }
    this.updateTotals();
}

Resources.prototype.playSongCallback = function(index) {
    var that = this;
    return function() {
        that.core.setSong(index);
    };
}

Resources.prototype.selectImageCallback = function(index) {
    var that = this;
    return function() {
        that.core.setImage(index);
        that.core.setIsFullAuto(false);
    };
}

Resources.prototype.removePack = function(pack) {
    var index = this.resourcePacks.indexOf(pack);
    if (index != -1) {
        this.resourcePacks.splice(index, 1);
        this.rebuildArrays();
    }
}

Resources.prototype.removeAllPacks = function() {
    this.resourcePacks = [];
    this.rebuildArrays();
}

Resources.prototype.getSongNames = function() {
    var names = []
    for(var i = 0; i < this.allSongs.length; i++) {
        names.push(this.allSongs[i]);
    }
    return names;
}

Resources.prototype.loadLocal = function() {
    console.log("Loading local zip(s)");
    var files = this.fileInput.files;
    for(var i = 0; i < files.length; i++) {
        this.fileParseQueue.push(files[i]);
    }
    this.parseLocalQueue();
}

Resources.prototype.parseLocalQueue = function(recursing) {
    var that = this;
    // avoid race conditions
    if(this.currentlyParsing && !recursing) {
        return;
    }
    this.currentlyParsing = true;
    if(this.fileParseQueue.length) {
        var r = new Respack();
        r.loadBlob(this.fileParseQueue.shift(), 
            function() {
                that.addPack(r);
                that.localComplete();
                that.parseLocalQueue(true);
            },
            function(progress, respack) {that.localProgress(progress, respack);},
            function() {that.parseLocalQueue(true);});
    } else {
        console.log("Local respack parsing complete");
        this.currentlyParsing = false;
    }
}

Resources.prototype.localProgress = function(progress, respack) {
    this.packsView.progressStatus.textContent = "Processing...";
    
    this.packsView.progressBar.style.width = (progress * 100) + "%";
    this.packsView.progressCurrent.textContent = respack.filesLoaded;
    this.packsView.progressTop.textContent = respack.filesToLoad;
    this.packsView.progressPercent.textContent = Math.round(progress * 100) + "%";
}

Resources.prototype.localComplete = function(progress) {
    var progStat = this.packsView.progressStatus;
    progStat.textContent = "Complete";
    window.setTimeout(function() {progStat.textContent = "Idle";}, 2000);
    
    this.packsView.progressBar.style.width = "100%";
    this.packsView.progressCurrent.textContent = "0b";
    this.packsView.progressTop.textContent = "0b";
    this.packsView.progressPercent.textContent = "0%";
}

Resources.prototype.initUI = function() {
    this.root = document.getElementById("huesResources");
    var that = this;
    
    var packsContainer = document.createElement("div");
    packsContainer.className = "res-packscontainer";
    
    var packHeader = document.createElement("div");
    packHeader.textContent = "Current respacks";
    packHeader.className = "res-header";
    packHeader.id = "res-curheader";
    var packList = document.createElement("div");
    packList.className = "res-list";
    packList.id = "res-packlist";
    this.packsView.respackList = packList;
    var remoteHeader = document.createElement("div");
    remoteHeader.textContent = "Remote respacks";
    remoteHeader.className = "res-header";
    var remoteList = document.createElement("div");
    remoteList.className = "res-list";
    remoteList.id = "res-remotelist";
    this.appendSimpleListItem("Click to load the list", remoteList,
        function() {that.loadRemotes();});
    this.packsView.remoteList = remoteList;
    
    var buttons = document.createElement("div");
    buttons.className = "res-buttons";
    var loadRemote = document.createElement("div");
    loadRemote.className = "res-button hidden";
    loadRemote.textContent = "LOAD REMOTE";
    loadRemote.onclick = function() {that.loadCurrentRemote();};
    var loadLocal = document.createElement("div");
    loadLocal.className = "res-button";
    loadLocal.textContent = "LOAD ZIPS";
    loadLocal.onclick = function() {that.fileInput.click();};
    buttons.appendChild(loadLocal);
    buttons.appendChild(loadRemote);
    this.packsView.loadRemote = loadRemote;
    
    this.fileInput = document.createElement("input");
    this.fileInput.type ="file";
    this.fileInput.accept="application/zip";
    this.fileInput.multiple = true;
    this.fileInput.onchange = function() {that.loadLocal();};

    var progressContainer = document.createElement("div");
    progressContainer.id = "res-progress-container";
    var progressBar = document.createElement("div");
    progressBar.id = "res-progress-bar";
    var progressFilled = document.createElement("span");
    progressFilled.id = "res-progress-filled";
    progressBar.appendChild(progressFilled);
    var progressStatus = document.createElement("div");
    progressStatus.textContent = "Idle";
    
    var progressTexts = document.createElement("div");
    progressTexts.id = "res-progress-texts";
    var progressCurrent = document.createElement("div");
    progressCurrent.id = "res-progress-current";
    progressCurrent.textContent = "0b";
    var progressTop = document.createElement("div");
    progressTop.id = "res-progress-top";
    progressTop.textContent = "0b";
    var progressPercent = document.createElement("div");
    progressPercent.id = "res-progress-percent";
    progressPercent.textContent = "0%";
    progressTexts.appendChild(progressCurrent);
    progressTexts.appendChild(progressTop);
    progressTexts.appendChild(progressPercent);
    
    this.packsView.progressBar = progressFilled;
    this.packsView.progressStatus = progressStatus;
    this.packsView.progressCurrent = progressCurrent;
    this.packsView.progressTop = progressTop;
    this.packsView.progressPercent = progressPercent;
    progressContainer.appendChild(progressStatus);
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressTexts);
    
    packsContainer.appendChild(packHeader);
    packsContainer.appendChild(packList);
    packsContainer.appendChild(remoteHeader);
    packsContainer.appendChild(remoteList);
    packsContainer.appendChild(buttons);
    packsContainer.appendChild(progressContainer);
    
    var indivView = document.createElement("div");
    indivView.className = "res-packcontainer";
    
    var packName = document.createElement("div");
    packName.textContent = "<select a respack>";
    var packInfo = document.createElement("div");
    packInfo.id = "res-packinfo";
    var packCreator = document.createElement("div");
    packCreator.id = "res-packcreator";
    var packCreatorText = document.createElement("a");
    packCreatorText.textContent = "<author>";
    packCreator.appendChild(packCreatorText);
    packInfo.appendChild(packCreator);
    var packSize = document.createElement("div");
    packSize.textContent = "0b";
    packInfo.appendChild(packSize);
    var packDesc = document.createElement("div");
    packDesc.id = "res-packdesc";
    packDesc.textContent = "<no description>"
    
    var packTabs = document.createElement("div");
    packTabs.id = "res-packtabs";
    
    var songCheck = document.createElement("input");
    songCheck.type = "radio";
    songCheck.name = "packtab";
    songCheck.value = "songs";
    songCheck.checked = true;
    songCheck.id = "res-songtab";
    var songCount = document.createElement("label");
    songCount.textContent = "Songs:";
    songCount.htmlFor = "res-songtab";
    packTabs.appendChild(songCheck);
    packTabs.appendChild(songCount);
    
    var imageCheck = document.createElement("input");
    imageCheck.type = "radio";
    imageCheck.name = "packtab";
    imageCheck.value = "images";
    imageCheck.id = "res-imagetab";
    var imageCount = document.createElement("label");
    imageCount.textContent = "Images:";
    imageCount.htmlFor = "res-imagetab";
    packTabs.appendChild(imageCheck);
    packTabs.appendChild(imageCount);
    ;
    var songList = document.createElement("div");
    songList.id = "res-songlist";
    songList.className = "res-list";
    var imageList = document.createElement("div");
    imageList.id = "res-imagelist";
    imageList.className = "res-list";
    packTabs.appendChild(songList);
    packTabs.appendChild(imageList);
    
    var packButtons = document.createElement("div");
    packButtons.className = "res-buttons hidden";
    packButtons.id = "res-packbuttons";
    var enableAll = document.createElement("div");
    enableAll.textContent = "ENABLE ALL";
    enableAll.className = "res-button";
    enableAll.onclick = function() {that.enableAll();};
    var invert = document.createElement("div");
    invert.textContent = "INVERT";
    invert.className = "res-button";
    invert.onclick = function() {that.invert();};
    var disableAll = document.createElement("div");
    disableAll.textContent = "DISABLE ALL";
    disableAll.className = "res-button";
    disableAll.onclick = function() {that.disableAll();};
    packButtons.appendChild(enableAll);
    packButtons.appendChild(invert);
    packButtons.appendChild(disableAll);
    
    var totalCounts = document.createElement("div");
    totalCounts.id = "res-countscontainer";
    
    var totalSongsCont = document.createElement("div");
    var totalSongsLabel = document.createElement("span");
    totalSongsLabel.textContent = "Total Songs:";
    var totalSongs = document.createElement("span");
    totalSongs.className = "res-counts";
    totalSongsCont.appendChild(totalSongsLabel);
    totalSongsCont.appendChild(totalSongs);

    var totalImagesCont = document.createElement("div");
    var totalImagesLabel = document.createElement("span");
    totalImagesLabel.textContent = "Total images:";
    var totalImages = document.createElement("span");
    totalImages.className = "res-counts";
    totalImagesCont.appendChild(totalImagesLabel);
    totalImagesCont.appendChild(totalImages);
    
    totalCounts.appendChild(totalSongsCont);
    totalCounts.appendChild(totalImagesCont);
    
    this.packView.name = packName;
    this.packView.creator = packCreatorText;
    this.packView.size = packSize;
    this.packView.desc = packDesc;
    this.packView.songCount = songCount;
    this.packView.imageCount = imageCount;
    this.packView.songList = songList;
    this.packView.imageList = imageList;
    this.packView.packButtons = packButtons;
    this.packView.totalSongs = totalSongs;
    this.packView.totalImages = totalImages;
    
    indivView.appendChild(packName);
    indivView.appendChild(packInfo);
    indivView.appendChild(packDesc);
    indivView.appendChild(packTabs);
    indivView.appendChild(packButtons);
    indivView.appendChild(totalCounts);
    
    this.root.appendChild(packsContainer);
    this.root.appendChild(indivView);
    
    this.listView = document.createElement("div");
    this.enabledSongList = document.createElement("div");
    this.enabledSongList.id = "res-enabledsonglist";
    this.enabledSongList.className = "hidden";
    this.enabledImageList = document.createElement("div");
    this.enabledImageList.id = "res-enabledimagelist";
    this.enabledImageList.className = "hidden";
    
    this.listView.appendChild(this.enabledSongList);
    this.listView.appendChild(this.enabledImageList);
}

Resources.prototype.hideLists = function() {
    this.enabledSongList.className = "hidden";
    this.enabledImageList.className = "hidden";
}

Resources.prototype.toggleSongList = function() {
    if(this.enabledSongList.className == "hidden") {
        this.enabledSongList.className = "res-list";
    } else {
        this.enabledSongList.className = "hidden";
    }
    this.enabledImageList.className = "hidden";
}

Resources.prototype.toggleImageList = function() {
    if(this.enabledImageList.className == "hidden") {
        this.enabledImageList.className = "res-list";
    } else {
        this.enabledImageList.className = "hidden";
    }
    this.enabledSongList.className = "hidden";
}

Resources.prototype.updateTotals = function() {
    this.packView.totalSongs.textContent =
            this.enabledSongs.length + "/" + this.allSongs.length;
    this.packView.totalImages.textContent =
            this.enabledImages.length + "/" + this.allImages.length;
}

Resources.prototype.truncateNum = function(num) {
    return Math.round(num * 100) / 100;
}

Resources.prototype.selectPack = function(id) {
    var pack = this.resourcePacks[id];
    this.packView.pack = pack;
    
    this.packView.packButtons.className = "res-buttons";
    this.packsView.loadRemote.className = "res-button hidden";
    
    this.packView.name.textContent = pack.name;
    this.packView.creator.textContent = pack.author;
    this.packView.creator.href = pack.link ? pack.link : "";
    var size = pack.size / 1024;
    if(size < 512) {
        this.packView.size.textContent = this.truncateNum(size) + "kB";
    } else {
        this.packView.size.textContent = this.truncateNum(size / 1024) + "MB";
    }
    this.packView.desc.textContent = pack.description;
    this.packView.songCount.textContent = "Songs: " + pack.songs.length;
    this.packView.imageCount.textContent = "Images: " + pack.images.length;
    
    var songList = this.packView.songList;
    var imageList = this.packView.imageList;
    while (songList.firstElementChild) {
        songList.removeChild(songList.firstElementChild)
    }    
    while (imageList.firstElementChild) {
        imageList.removeChild(imageList.firstElementChild)
    }
    
    for(var i = 0; i < pack.songs.length; i++) {
        var song = pack.songs[i];
        this.appendListItem("songs", song.title, "song" + i, songList,
            this.selectResourceCallback(song),
            this.clickResourceCallback(song, true),
            song.enabled);
    }
    
    for(var i = 0; i < pack.images.length; i++) {
        var image = pack.images[i];
        this.appendListItem("images", image.name, "image" + i, imageList,
            this.selectResourceCallback(image),
            this.clickResourceCallback(image, false),
            image.enabled);
    }
}

Resources.prototype.selectPackCallback = function(id) {
    var that = this;
    return function() {that.selectPack(id)};
}

Resources.prototype.selectResourceCallback = function(res) {
    var that = this;
    return function() {
        res.enabled = this.checked;
        that.rebuildEnabled();
    };
}

Resources.prototype.clickResourceCallback = function(res, isSong) {
    var that = this;
    return function() {
        if(!res.enabled) {
            res.enabled = true;
            that.rebuildEnabled();
            // rebuild display
            that.selectPack(that.resourcePacks.indexOf(that.packView.pack));
        }
        if(isSong) {
            that.core.setSong(that.enabledSongs.indexOf(res));
        } else {
            that.core.setImage(that.enabledImages.indexOf(res));
            that.core.setIsFullAuto(false);
        }
    };
}

Resources.prototype.getEnabledTabContents = function() {
    var pack = this.packView.pack;
    if(!pack) {
        return null;
    }
    var ret = {arr: pack.images,
               elName: "image"};
    if(document.getElementById("res-songtab").checked) {
        ret.arr = pack.songs;
        ret.elName = "song";
    }
    return ret;
}

Resources.prototype.enableAll = function() {
    var tab = this.getEnabledTabContents();
    if(!tab)
        return;
    for(var i = 0; i < tab.arr.length; i++) {
        tab.arr[i].enabled = true;
        document.getElementById(tab.elName + i).checked = true;
    }    
    this.rebuildEnabled();
}

Resources.prototype.disableAll = function() {
    var tab = this.getEnabledTabContents();
    if(!tab)
        return;
    for(var i = 0; i < tab.arr.length; i++) {
        tab.arr[i].enabled = false;
        document.getElementById(tab.elName + i).checked = false;
    }    
    this.rebuildEnabled();
}

Resources.prototype.invert = function() {
    var tab = this.getEnabledTabContents();
    if(!tab)
        return;
    for(var i = 0; i < tab.arr.length; i++) {
        tab.arr[i].enabled = !tab.arr[i].enabled;
        document.getElementById(tab.elName + i).checked = tab.arr[i].enabled;
    }    
    this.rebuildEnabled();
}

Resources.prototype.appendListItem = function(name, value, id, root, oncheck, onclick, checked) {
    if(checked == undefined) {
        checked = true;
    }
    var div = document.createElement("div");
    div.className = "res-listitem";
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = name;
    checkbox.value = value;
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.onclick = oncheck;
    var checkStyler = document.createElement("label");
    checkStyler.htmlFor = checkbox.id;
    var label = document.createElement("span");
    label.textContent = value;
    label.onclick = onclick;
    div.appendChild(checkbox);
    div.appendChild(checkStyler);
    div.appendChild(label);
    root.appendChild(div);
}

Resources.prototype.loadRemotes = function() {
    var that = this;
    var remoteList = this.packsView.remoteList;
    while(remoteList.firstElementChild) {
        remoteList.removeChild(remoteList.firstElementChild)
    }
    var item = this.appendSimpleListItem("Loading...", remoteList);
    
    var req = new XMLHttpRequest();
    req.open('GET', packsURL, true);
    req.responseType = 'json';
    req.onload = function() {
        if(!req.response) {
            req.onerror();
        }
        that.remotes = req.response;
        that.populateRemotes();
    };
    req.onerror = function() {
        item.textContent = "Could not load list! Click to try again";
        item.onclick = function() {that.loadRemotes();};
    }
    req.send();
}

Resources.prototype.populateRemotes = function() {
    var remoteList = this.packsView.remoteList;
    while(remoteList.firstElementChild) {
        remoteList.removeChild(remoteList.firstElementChild)
    }
    for(var i = 0; i < this.remotes.length; i++) {
        this.remotes[i].loaded = false;
        this.appendSimpleListItem(this.remotes[i].name, remoteList,
            this.getRemoteCallback(i));
    }
}

Resources.prototype.getRemoteCallback = function(index) {
    var that = this;
    return function() {that.selectRemotePack(index);};
}

Resources.prototype.selectRemotePack = function(id) {
    var pack = this.remotes[id];
    this.packView.pack = pack;
    
    this.packView.packButtons.className = "res-buttons hidden";
    this.packsView.loadRemote.className = "res-button";
    if(pack.loaded) {
        this.packsView.loadRemote.className += " loaded";
        this.packsView.loadRemote.textContent = "LOADED";
    } else {
        this.packsView.loadRemote.textContent = "LOAD REMOTE";
    }
    
    this.packView.name.textContent = pack.name;
    this.packView.creator.textContent = pack.author;
    this.packView.creator.href = pack.link ? pack.link : "";
    var size = pack.size / 1024;
    if(size < 512) {
        this.packView.size.textContent = this.truncateNum(size) + "kB";
    } else {
        this.packView.size.textContent = this.truncateNum(size / 1024) + "MB";
    }
    this.packView.desc.textContent = pack.description;
    this.packView.songCount.textContent = "Songs: " + pack.songcount;
    this.packView.imageCount.textContent = "Images: " + pack.imagecount;
    
    var songList = this.packView.songList;
    var imageList = this.packView.imageList;
    while (songList.firstElementChild) {
        songList.removeChild(songList.firstElementChild)
    }    
    while (imageList.firstElementChild) {
        imageList.removeChild(imageList.firstElementChild)
    }
    
    for(var i = 0; i < pack.songs.length; i++) {
        var song = pack.songs[i];
        this.appendSimpleListItem(song, songList);
    }
    
    for(var i = 0; i < pack.images.length; i++) {
        var image = pack.images[i];
        this.appendSimpleListItem(image, imageList);
    }
}

Resources.prototype.loadCurrentRemote = function() {
    var pack = this.packView.pack;
    var that = this;
    
    // Not actually a remote, ignore. How did you press this :<
    if(pack.loaded == undefined || pack.loaded) {
        return;
    }
    
    // TODO Error checking on failure
    pack.loaded = true;
    that.packsView.loadRemote.className = "res-button loaded";
    that.packsView.loadRemote.textContent = "LOADING";
    this.addAll([pack.url], function() {
            that.remoteComplete();
        }, function(progress, respack) {that.remoteProgress(progress, respack);}
    );
}

Resources.prototype.remoteProgress = function(progress, respack) {
    if(progress < 0.5) {
        this.packsView.progressStatus.textContent = "Downloading...";
        this.packsView.progressCurrent.textContent = Math.round(respack.downloaded / 1024) + "b";
        this.packsView.progressTop.textContent = Math.round(respack.size / 1024) + "b";
        this.packsView.progressBar.style.width = (progress * 2 * 100) + "%";
        this.packsView.progressPercent.textContent = Math.round(progress * 2 * 100) + "%";
    } else {
        this.packsView.progressStatus.textContent = "Processing...";
        this.packsView.progressCurrent.textContent = respack.filesLoaded;
        this.packsView.progressTop.textContent = respack.filesToLoad;
        this.packsView.progressBar.style.width = ((progress - 0.5) * 2 * 100) + "%";
        this.packsView.progressPercent.textContent = Math.round((progress - 0.5) * 2 * 100) + "%";
    }
}

Resources.prototype.remoteComplete = function(progress) {
    var progStat = this.packsView.progressStatus;
    progStat.textContent = "Complete";
    window.setTimeout(function() {progStat.textContent = "Idle";}, 2000);
    this.packsView.loadRemote.textContent = "LOADED";
    
    this.packsView.progressBar.style.width = "100%";
    this.packsView.progressCurrent.textContent = "0b";
    this.packsView.progressTop.textContent = "0b";
    this.packsView.progressPercent.textContent = "0%";
}

Resources.prototype.appendSimpleListItem = function(value, root, onclick) {
    var div = document.createElement("div");
    div.className = "res-listitem";
    var label = document.createElement("span");
    label.textContent = value;
    label.onclick = onclick;
    div.appendChild(label);
    root.appendChild(div);
    return label;
}