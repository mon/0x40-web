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
    this.resourcePacks.push(pack);
    this.addResourcesToArrays(pack);
    this.rebuildEnabled();
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