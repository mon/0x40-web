HuesCore = function(defaults) {
    // Bunch-o-initialisers
    this.version = "0x01";
    this.beatIndex = 0;
    this.beatLength=-1;
    this.currentSong;
    this.currentImage;
    this.songIndex=-1;
    this.colourIndex=0x3f;
    this.imageIndex=-1;
    this.isFullAuto = true;
    this.loopCount=0;
    this.fadeOut=false;
    this.fadeDirection=false;
    this.loadedFiles=0;
    this.doBuildup=true;
    this.userInterface = null;
    
    var that = this;
    window.onerror = function(msg, url, line, col, error) {
        that.error(msg);
        // Get more info in console
        return false;
    };
    
    console.log("0x40 Hues - start your engines!");
    this.colours = this.oldColours;
    this.uiArray = [];
    this.lastSongArray = [];
    this.lastImageArray = [];
    this.settings = new HuesSettings(defaults);
    //this.autoSong = this.settings.autosong;
    this.resourceManager = new Resources(this);
    this.soundManager = new SoundManager(this);
    if(!this.soundManager.canUse) {
        this.error(this.soundManager.errorMsg);
        return;
    }
    this.renderer = new HuesCanvas("waifu", this.soundManager.context, this);
    
    this.uiArray.push(new RetroUI(), new WeedUI(), new ModernUI(), new XmasUI());
    this.settings.connectCore(this);
    this.setColour(this.colourIndex);
    
    if(defaults.load) {
        this.resourceManager.addAll(defaults.respacks, function() {
            document.getElementById("preloadHelper").className = "loaded";
            window.setTimeout(function() {
                document.getElementById("preloadHelper").style.display = "none";
            }, 1500);
            that.setImage(0);
            if(defaults.autoplay) {
                that.setSong(0);
            }
        }, function(progress) {
            var prog = document.getElementById("preMain");
            var scale = Math.floor(progress * 0x40);
            prog.textContent = '0x' + ("00"+scale.toString(16)).slice(-2);
        });
    } else {
        document.getElementById("preloadHelper").style.display = "none";
    }

    document.onkeydown = function(e){
        e = e || window.event;
        // Ignore modifiers so we don't steal other events
        // Shift is actually used, and is thus ignored here
        if (e.altKey || e.ctrlKey || e.metaKey) {
            return true;
        }
        var key = e.keyCode || e.which;
        return that.keyHandler(key);
    };
    
    this.animationLoop();
}

HuesCore.prototype.animationLoop = function() {
    var that = this;
    if(!this.soundManager.playing) {
        requestAnimationFrame(function() {that.animationLoop()});
        return;
    }
    var now = this.soundManager.currentTime();
    if(now < 0) {
        this.userInterface.updateTime(0);
    } else {
        this.userInterface.updateTime(this.soundManager.displayableTime());
        if(this.doBuildup) {
            this.currentSong.buildupPlayed = true;
        }
    }
    for(var beatTime = this.beatIndex * this.beatLength; beatTime < now;
            beatTime = ++this.beatIndex * this.beatLength) {
        var beat = this.getBeat(this.beatIndex);
        this.beater(beat);
    }
    requestAnimationFrame(function() {that.animationLoop()});
}

HuesCore.prototype.getCurrentMode = function() {
    return this.isFullAuto ? "FULL AUTO" : "NORMAL";
}

HuesCore.prototype.getSafeBeatIndex = function() {
    if(!this.soundManager.playing) {
        return 0;
    }
    if(this.beatIndex < 0) {
        return 0;
    } else {
        return this.beatIndex % this.currentSong.rhythm.length;
    }
}

HuesCore.prototype.blurUpdated = function(x, y) {
    this.userInterface.blurUpdated(x, y);
}

HuesCore.prototype.nextSong = function() {
    this.lastSongArray = [];
    var index = (this.songIndex + 1) % this.resourceManager.enabledSongs.length;
    this.setSong(index);
}

HuesCore.prototype.previousSong = function() {
    this.lastSongArray = [];
    var index = ((this.songIndex - 1) + this.resourceManager.enabledSongs.length) % this.resourceManager.enabledSongs.length;
    this.setSong(index);
}

HuesCore.prototype.setSongByName = function(name) {
    var songs = this.resourceManager.enabledSongs;
    for(var i = 0; i < songs.length; i++) {
        if(songs[i].title == name) {
            this.setSong(i);
            return;
        }
    }
    this.setSong(0); // fallback
}

HuesCore.prototype.setSong = function(index) {
    if(this.currentSong == this.resourceManager.enabledSongs[index]) {
        return;
    }
    this.songIndex = index;
    this.currentSong = this.resourceManager.enabledSongs[this.songIndex];
    if (this.currentSong == undefined) {
        this.currentSong = {"name":"None", "title":"None", "rhythm":".", "source":null, "crc":"none", "sound":null, "enabled":true, "filename":"none"};
    }
    console.log("Next song:", this.songIndex, this.currentSong);
    this.userInterface.setSongText();
    this.loopCount = 0;
    if (this.currentSong.buildup) {
        switch (localStorage["playBuildups"]) {
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
    var that = this;
    this.soundManager.playSong(this.currentSong, this.doBuildup, function() {
        that.resetAudio();
        that.fillBuildup();
    });
}

HuesCore.prototype.fillBuildup = function() {
    this.beatLength = this.soundManager.loopLength / this.currentSong.rhythm.length;
    var buildBeats = Math.floor(this.soundManager.loopStart / this.beatLength) + 1;
    if (this.currentSong.buildupRhythm == null) {
        this.currentSong.buildupRhythm = "";
    }
    if (this.currentSong.buildupRhythm.length < buildBeats) {
        console.log("Filling buildup beatmap");
        while (this.currentSong.buildupRhythm.length < buildBeats) {
            this.currentSong.buildupRhythm = this.currentSong.buildupRhythm + ".";
        }
    }
    console.log("Buildup length:", buildBeats);
    this.beatIndex = this.doBuildup ? -this.currentSong.buildupRhythm.length : 0;
}

HuesCore.prototype.randomSong = function() {
    var index=Math.floor((Math.random() * this.resourceManager.enabledSongs.length));
    if (index == this.songIndex && this.resourceManager.enabledSongs.length > 1 || !(this.lastSongArray.indexOf(index) == -1)) {
        this.randomSong();
    } else {
        console.log("Randoming a song!");
        this.setSong(index);
        this.lastSongArray.push(index);
        noRepeat = Math.min(5, Math.floor((this.resourceManager.enabledSongs.length / 2)));
        while (this.lastSongArray.length > noRepeat && noRepeat >= 0) {
            this.lastSongArray.shift();
        }
    }
}
/*
HuesCore.prototype.onLoop = function() {
    this.loopCount = this.loopCount + 1;
    switch (this.settings.autosong) {
    case "loop":
        console.log("Checking loops");
        if (this.loopCount >= this.settings.autosongDelay) {
            this.startSongChangeFade();
        }
        break;
    case "time":
        console.log("Checking times");
        if (this.currentSong.sound && this.calculateSongLength(this.currentSong.sound) / 1000 * this.loopCount >= this.settings.autosongDelay * 60) {
            this.startSongChangeFade();
        }
        break;
    }
}

HuesCore.prototype.startSongChangeFade = function() {
    this.fadeDirection = true;
    this.fadeOut = true;
}
*/
HuesCore.prototype.songDataUpdated = function() {
    if (this.currentSong) {
        this.beatLength = 0;
        this.userInterface.updateLists();
        this.userInterface.setSongText();
        this.userInterface.setImageText();
    } else {
        this.beatLength = -1;
    }
}

HuesCore.prototype.resetAudio = function() {
    this.samplePosition = 0;
    this.beatIndex = 0;
    this.position = 0;
    this.songDataUpdated();
}

HuesCore.prototype.randomImage = function() {
    var len = this.resourceManager.enabledImages.length;
    var index=Math.floor(Math.random() * len);
    if ((index == this.imageIndex || this.lastImageArray.indexOf(index) != -1) && len > 1) {
        this.randomImage();
    } else {
        this.setImage(index);
        this.lastImageArray.push(index);
        var cull = Math.min(20, Math.floor((len / 2)));
        while (this.lastImageArray.length > cull && cull >= 0) {
            this.lastImageArray.shift();
        }
    }
}

HuesCore.prototype.setImage = function(index) {
    // If there are no images, this corrects NaN to 0
    this.imageIndex = index ? index : 0;
    var img=this.resourceManager.enabledImages[this.imageIndex];
    if (img == this.currentImage && !(img == null)) {
        return;
    }
    if (img) {
        this.currentImage = img;
    } else {
        this.currentImage = {"name":"None", "fullname":"None", "align":"center", "bitmap":null, "source":null, "enabled":true};
        this.imageIndex = -1;
        this.lastImageArray = [];
    }
    this.renderer.setImage(this.currentImage);
    this.userInterface.setImageText();
}

HuesCore.prototype.nextImage = function() {
    this.setIsFullAuto(false);
    var img=(this.imageIndex + 1) % this.resourceManager.enabledImages.length;
    this.setImage(img);
    this.lastImageArray = [];
}

HuesCore.prototype.previousImage = function() {
    this.setIsFullAuto(false);
    var img=((this.imageIndex - 1) + this.resourceManager.enabledImages.length) % this.resourceManager.enabledImages.length;
    this.setImage(img);
    this.lastImageArray = [];
}

HuesCore.prototype.randomColourIndex = function() {
    var index=Math.floor((Math.random() * 64));
    if (index == this.colourIndex) {
        return this.randomColourIndex();
    }
    return index;
}

HuesCore.prototype.randomColour = function() {
    var index=this.randomColourIndex();
    this.setColour(index);
}

HuesCore.prototype.setColour = function(index) {
    this.colourIndex = index;
    this.renderer.setColour(this.colours[this.colourIndex].c);
    this.userInterface.setColourText();
}

HuesCore.prototype.getBeat = function(index) {
    if(index < 0) {
        return this.currentSong.buildupRhythm[this.currentSong.buildupRhythm.length+index];
    } else {
        return this.currentSong.rhythm[index % this.currentSong.rhythm.length];
    }
}

HuesCore.prototype.beater = function(beat) {
    this.userInterface.beat();
    switch(beat) {
        case 'X':
        case 'x':
            this.renderer.doYBlur();
            break;
        case 'O':
        case 'o':
            this.renderer.doXBlur();
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
            this.renderer.doShortBlackout(this.beatLength);
            this.randomColour();
            break;
        case ':':
            this.randomColour();
            break;
        case '*':
            if(this.isFullAuto) {
                this.randomImage();
            }
            break;
        case '=':
            if(this.isFullAuto) {
                this.randomImage();
            }
        case '~':
            // case: fade in build, not in rhythm. Must max out fade timer.
            var maxSearch = this.currentSong.rhythm.length;
            if(this.beatIndex < 0) {
                maxSearch -= this.beatIndex;
            }
            var fadeLen;
            for (fadeLen = 1; fadeLen <= maxSearch; fadeLen++) {
                if (this.getBeat(fadeLen + this.beatIndex) != ".") {
                    break;
                }
            }
            this.stopFade();
            this.startFade(fadeLen * this.beatLength);
            break;
        }
        if ([".", "+", "|", "¤"].indexOf(beat) == -1) {
            this.renderer.clearBlackout();
        }
        if([".", "+", ":", "*", "X", "O", "~", "="].indexOf(beat) == -1) {
            this.randomColour();
            if (this.isFullAuto) {
                this.randomImage();
            }
    }
}

HuesCore.prototype.getBeatString = function(length) {
    length = length ? length : 256;

    var beatString = "";
    var song = this.currentSong;
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

HuesCore.prototype.setIsFullAuto = function(auto) {
    this.isFullAuto = auto;
    if (this.userInterface) {
        this.userInterface.modeUpdated();
    }
}

HuesCore.prototype.toggleFullAuto = function() {
    this.setIsFullAuto(!this.isFullAuto);
}

/*HuesCore.prototype.enterFrame = function() {
    this.setTexts();
    if (this.fadeOut) {
        // 30fps frame locked, TODO
        delta = this.fadeDirection ? -2 : 2;
        if (this.soundChannel) {
            fadeTo = Math.max(0, Math.min(this.currentVolume, soundManager.volume + delta));
            this.soundManager.setVolume(fadeTo);
            if (fadeTo == 0) {
                this.fadeOut = false;
                this.fadeDirection = false;
                if (this.settings.autosongShuffle) {
                    this.randomSong();
                } else {
                    this.nextSong();
                }
            }
        }
    }
}*/

HuesCore.prototype.respackLoaded = function() {
    this.init();
    this.userInterface.updateLists();
}

/*HuesCore.prototype.rightClickListener = function(event) {
    switch (event) {
    case flash.events.MouseEvent.RIGHT_CLICK:
        this.toggleSettingsWindow();
        break;
    case flash.events.MouseEvent.MOUSE_WHEEL:
        if (event.delta > 0) {
            this.soundManager.increaseVolume();
        } else {
            this.soundManager.decreaseVolume();
        }
        break;
    }
}*/

HuesCore.prototype.changeUI = function(index) {
    if (index >= 0 && this.uiArray.length > index && !(this.userInterface == this.uiArray[index])) {
        if(this.userInterface)
            this.userInterface.disconnect();
        this.userInterface = this.uiArray[index];
        this.userInterface.connectCore(this);
        this.userInterface.updateLists();
        this.userInterface.setSongText();
        this.userInterface.setImageText();
        this.userInterface.setColourText(this.colourIndex);
        this.userInterface.beat();
        this.userInterface.modeUpdated();
    }
}

HuesCore.prototype.settingsUpdated = function() {
    this.renderer.setSmartAlign(localStorage["smartAlign"]);
    this.renderer.setBlurAmount(localStorage["blurAmount"]);
    this.renderer.setBlurDecay(localStorage["blurDecay"]);
    this.renderer.setBlurQuality(localStorage["blurQuality"]);
    switch (localStorage["currentUI"]) {
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
    }
    switch (localStorage["colourSet"]) {
    case "normal":
        this.colours = this.oldColours;
        break;
    case "pastel":
        this.colours = this.pastelColours;
        break;
    case "v4.20":
        this.colours = this.weedColours;
        break;
    }
    switch (localStorage["blackoutUI"]) {
    case "off":
        this.userInterface.show();
        break;
    case "on":
        if(this.renderer.blackout) {
            this.userInterface.hide();
        }
        break;
    }
    /*if (this.autoSong == "off" && !(this.settings.autosong == "off")) {
        console.log("Resetting loopCount since AutoSong was enabled");
        this.loopCount = 0;
        this.autoSong = this.settings.autosong;
    }*/
}

HuesCore.prototype.enabledChanged = function() {
    this.resourceManager.rebuildEnabled();
    this.userInterface.updateLists();
}

HuesCore.prototype.hideLists = function() {
    this.userInterface.songList.hide();
    this.userInterface.imageList.hide();
}

HuesCore.prototype.toggleSongList = function() {
    this.userInterface.songList.toggleHide();
    this.userInterface.imageList.hide();
}

HuesCore.prototype.toggleImageList = function() {
    this.userInterface.imageList.toggleHide();
    this.userInterface.songList.hide();
}

HuesCore.prototype.openSongSource = function() {
    if (this.currentSong && this.currentSong.source) {
        window.open(this.currentSong.source,'_blank');
    }
}

HuesCore.prototype.openImageSource = function() {
    if (this.currentImage && this.currentImage.source) {
        window.open(this.currentImage.source,'_blank');
    }
}

HuesCore.prototype.keyHandler = function(key) {
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
        this.setIsFullAuto(!this.isFullAuto);
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
    case 77: // M
        this.soundManager.toggleMute();
        break;
    case 72: // H
        this.userInterface.toggleHide();
        break;
    case 82: // R
        this.settings.showRespacks();
        break;
    /*case 69: // E
        this.window.showEditor();
        break;*/
    case 79: // O
        this.settings.showOptions();
        break;
    case 73: // I
        this.settings.showInfo();
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
    case 76: // L
        this.loadLocal();
        break;
    case 67: // C
        this.toggleImageList();
        break;
    case 83: // S
        this.toggleSongList();
        break;
    case 87: // W
        this.settings.toggle();
        break;
    case 16: // SHIFT
        this.randomSong();
        break;
    default:
        return true;
    }
    return false;
}

HuesCore.prototype.error = function(message) {
    document.getElementById("preSub").textContent = "Error: " + message;
    document.getElementById("preMain").style.color = "#F00";
}

HuesCore.prototype.oldColours = 
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
HuesCore.prototype.pastelColours = 
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
HuesCore.prototype.weedColours = 
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