function Resources() {
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
    this.packView = {
        name: null,
        creator: null,
        size: null,
        desc: null,
        songCount: null,
        imageCount: null,
        songList: null,
        imageList: null,
        totalSongs: null,
        totalImages: null
    };
    this.packsView = {
        respackList: null,
        remoteList: null,
        progressBar: null,
        progressStatus: null,
        progressCurrent: null,
        progressTop: null,
        progressPercent: null
    };
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
    return function(progress) {
        that.progressState[i] = progress;
        that.updateProgress();
    }
}

Resources.prototype.updateProgress = function() {
    var total = 0;
    for(var i = 0; i < this.progressState.length; i++) {
        total += this.progressState[i];
    }
    total /= this.progressState.length;
    this.progressCallback(total);
}

Resources.prototype.addPack = function(pack) {
    console.log("Added", pack.name, "to respacks");
    var id = "res" + this.resourcePacks.length;
    this.resourcePacks.push(pack);
    this.addResourcesToArrays(pack);
    this.rebuildEnabled();
    this.updateTotals();
    
    this.appendListItem("respacks", pack.name, id, this.packsView.respackList);
    if(id == "res0") {
        this.selectPack(0);
    }
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
    enabledSongs = [];
    enabledImages = [];
    _enabledAnimations = [];

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

Resources.prototype.initUI = function() {
    this.root = document.getElementById("huesResources");
    
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
    this.packsView.remoteList = remoteList;
    
    var buttons = document.createElement("div");
    buttons.className = "res-buttons";
    var loadRemote = document.createElement("div");
    loadRemote.className = "res-button";
    loadRemote.textContent = "LOAD";
    var loadLocal = document.createElement("div");
    loadLocal.className = "res-button";
    loadLocal.textContent = "LOAD ZIPS";
    buttons.appendChild(loadRemote);
    buttons.appendChild(loadLocal);
    
    var progressContainer = document.createElement("div");
    var progressBar = document.createElement("div");
    var progressStatus = document.createElement("div");
    var progressCurrent = document.createElement("div");
    var progressTop = document.createElement("div");
    var progressPercent = document.createElement("div");
    this.packsView.progressBar = progressBar;
    this.packsView.progressStatus = progressStatus;
    this.packsView.progressCurrent = progressCurrent;
    this.packsView.progressTop = progressTop;
    this.packsView.progressPercent = progressPercent;
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressStatus);
    progressContainer.appendChild(progressCurrent);
    progressContainer.appendChild(progressTop);
    progressContainer.appendChild(progressPercent);
    
    packsContainer.appendChild(packHeader);
    packsContainer.appendChild(packList);
    packsContainer.appendChild(remoteHeader);
    packsContainer.appendChild(remoteList);
    packsContainer.appendChild(buttons);
    packsContainer.appendChild(progressContainer);
    
    var indivView = document.createElement("div");
    indivView.className = "res-packcontainer";
    
    var packName = document.createElement("div");
    var packInfo = document.createElement("div");
    packInfo.id = "res-packinfo";
    var packCreator = document.createElement("div");
    packCreator.id = "res-packcreator";
    var packCreatorText = document.createElement("a");
    packCreator.appendChild(packCreatorText);
    packInfo.appendChild(packCreator);
    var packSize = document.createElement("div");
    packInfo.appendChild(packSize);
    var packDesc = document.createElement("div");
    packDesc.id = "res-packdesc";
    
    var packTabs = document.createElement("div");
    packTabs.id = "res-packtabs";
    var songCount = document.createElement("div");
    songCount.textContent = "Songs:";
    packTabs.appendChild(songCount);
    var imageCount = document.createElement("div");
    imageCount.textContent = "Images:";
    packTabs.appendChild(imageCount);
    
    var packContents = document.createElement("div");
    packContents.className = "res-list";
    packContents.id = "res-packcontents";
    var songList = document.createElement("div");
    packContents.appendChild(songList);
    var imageList = document.createElement("div");
    packContents.appendChild(imageList);
    
    var packButtons = document.createElement("div");
    packButtons.className = "res-buttons";
    packButtons.id = "res-packbuttons";
    var enableAll = document.createElement("div");
    enableAll.textContent = "ENABLE ALL";
    enableAll.className = "res-button";
    var invert = document.createElement("div");
    invert.textContent = "INVERT";
    invert.className = "res-button";
    var disableAll = document.createElement("div");
    disableAll.textContent = "DISABLE ALL";
    disableAll.className = "res-button";
    packButtons.appendChild(enableAll);
    packButtons.appendChild(invert);
    packButtons.appendChild(disableAll);
    
    var totalCounts = document.createElement("div");
    var totalSongs = document.createElement("div");
    totalSongs.textContent = "Total Songs:";
    var totalImages = document.createElement("div");
    totalImages.textContent = "Total images:";
    totalCounts.appendChild(totalSongs);
    totalCounts.appendChild(totalImages);
    
    this.packView.name = packName;
    this.packView.creator = packCreatorText;
    this.packView.size = packSize;
    this.packView.desc = packDesc;
    this.packView.songCount = songCount;
    this.packView.imageCount = imageCount;
    this.packView.songList = songList;
    this.packView.imageList = imageList;
    this.packView.totalSongs = totalSongs;
    this.packView.totalImages = totalImages;
    
    indivView.appendChild(packName);
    indivView.appendChild(packInfo);
    indivView.appendChild(packDesc);
    indivView.appendChild(packTabs);
    indivView.appendChild(packContents);
    indivView.appendChild(packButtons);
    indivView.appendChild(totalCounts);
    
    this.root.appendChild(packsContainer);
    this.root.appendChild(indivView);
}

Resources.prototype.updateTotals = function() {
    this.packView.totalSongs.textContent = "Total songs: " + 
            this.enabledSongs.length + "/" + this.allSongs.length;
    this.packView.totalImages.textContent = "Total images: " + 
            this.enabledImages.length + "/" + this.allImages.length;
}

Resources.prototype.selectPack = function(id) {
    var pack = this.resourcePacks[id];
    
    this.packView.name.textContent = pack.name;
    this.packView.creator.textContent = pack.author;
    this.packView.creator.href = pack.link ? pack.link : "";
    this.packView.size.textContent = Math.round(pack.size / 1024, 2) + "kiB";
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
        this.appendListItem("songs", song.title, "song" + i, songList);
    }
    
    for(var i = 0; i < pack.images.length; i++) {
        var image = pack.images[i];
        this.appendListItem("images", image.name, "image" + i, imageList);
    }
}

Resources.prototype.appendListItem = function(name, value, id, root) {
    var div = document.createElement("div");
    div.className = "res-listitem";
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = name;
    checkbox.value = value;
    checkbox.id = id;
    checkbox.checked = true;
    var label = document.createElement("span");
    label.textContent = value;
    div.appendChild(checkbox);
    div.appendChild(label);
    root.appendChild(div);
}