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

let TAB_SONGS = 0;
let TAB_IMAGES = 1;

// For multiple Hues on one page
let unique = 0;
let getAndIncrementUnique = function() {
    return unique++;
};

class Resources {
    constructor(core, huesWin) {
        this.core = core;
        this.hasUI = false;

        this.resourcePacks = [];

        this.allSongs = [];
        this.allImages = [];
        this.enabledSongs = [];
        this.enabledImages = [];

        this.progressState = [];
        this.progressCallback = null;

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
        this.currentTab = TAB_SONGS;
        this.unique = getAndIncrementUnique();
        this.remotes = null;
        this.fileInput = null;
        this.fileParseQueue = [];
        if(core.settings.enableWindow) {
            this.initUI();
            huesWin.addTab("RESOURCES", this.root);
        }
    }

    /* Uses HTTP HEAD requests to get the size of all the linked URLs
       Returns an Promise.all which will resolve to an array of sizes */
    getSizes(urls) {
        let promises = [];

        urls.forEach(url => {
            let p = new Promise((resolve, reject) => {
                let xhr = new XMLHttpRequest();
                xhr.open("HEAD", url, true);
                xhr.onreadystatechange = function() {
                    if (this.readyState == this.DONE) {
                        let bytes = parseInt(xhr.getResponseHeader("Content-Length"));
                        resolve(bytes / 1024 / 1024);
                    }
                };
                xhr.onerror = function() {
                    reject(Error(req.status + ": Could not fetch respack at " + url));
                };
                xhr.send();
            }).catch(error => {
                // Infinitely more user friendly than the error Same Origin gives
                if(error.code == 1012) {
                    throw Error("Respack at URL " + url + " is restricted. Check CORS.");
                } else {
                    throw error;
                }
            });
            promises.push(p);
        });

        return Promise.all(promises);
    }

    // Array of URLs to load, and a callback for when we're done
    // Preserves order of URLs being loaded
    addAll(urls, progressCallback) {
        if(progressCallback) {
            this.progressCallback = progressCallback;
            this.progressState = Array.apply(null, Array(urls.length)).map(Number.prototype.valueOf,0);
        }

        let respackPromises = [];

        let progressFunc = function(index, progress, pack) {
                this.progressState[index] = progress;
                this.updateProgress(pack);
        };

        for(let i = 0; i < urls.length; i++) {
            let r = new Respack();
            respackPromises.push(r.loadFromURL(urls[i], progressFunc.bind(this, i)));
        }
        // Start all the promises at once, but add in sequence
        return respackPromises.reduce((sequence, packPromise) => {
            return sequence.then(() => {
                return packPromise;
            }).then(pack => {
                this.addPack(pack);
            });
        }, Promise.resolve());
    }

    updateProgress(pack) {
        let total = 0;
        for(let i = 0; i < this.progressState.length; i++) {
            total += this.progressState[i];
        }
        total /= this.progressState.length;
        this.progressCallback(total, pack);
    }

    addPack(pack) {
        console.log("Added", pack.name, "to respacks");
        let id = this.resourcePacks.length;
        this.resourcePacks.push(pack);
        this.addResourcesToArrays(pack);
        this.rebuildEnabled();
        this.updateTotals();

        let self = this;
        this.appendListItem("respacks", pack.name, "res" + id, this.packsView.respackList,
            function() {
                pack.enabled = this.checked;
                self.rebuildEnabled();
            }, function(id) {
                this.selectPack(id);
            }.bind(this, id)
        );
    }

    addResourcesToArrays(pack) {
        this.allImages = this.allImages.concat(pack.images);
        this.allSongs = this.allSongs.concat(pack.songs);
    }

    rebuildArrays() {
        this.allSongs = [];
        this.allImages = [];
        this.allAnimations = [];

        for(let i = 0; i < this.resourcePacks.length; i++) {
            this.addResourcesToArrays(this.resourcePacks[i]);
        }
    }

    rebuildEnabled() {
        this.enabledSongs = [];
        this.enabledImages = [];

        for(let i = 0; i < this.resourcePacks.length; i++) {
            let pack = this.resourcePacks[i];
            if (pack.enabled !== true) {
                continue;
            }
            for(let j = 0; j < pack.songs.length; j++) {
                let song = pack.songs[j];
                if (song.enabled && this.enabledSongs.indexOf(song) == -1) {
                    this.enabledSongs.push(song);
                }
            }
            for(let j = 0; j < pack.images.length; j++) {
                let image = pack.images[j];
                if (image.enabled && this.enabledImages.indexOf(image) == -1) {
                   this.enabledImages.push(image);
                }
            }
        }
        if(this.hasUI) {
            let songList = this.enabledSongList;
            while(songList.firstElementChild) {
                songList.removeChild(songList.firstElementChild);
            }
            let imageList = this.enabledImageList;
            while(imageList.firstElementChild) {
                imageList.removeChild(imageList.firstElementChild);
            }
            for(let i = 0; i < this.enabledSongs.length; i++) {
                let song = this.enabledSongs[i];
                this.appendSimpleListItem(song.title, songList, function(index) {
                    this.core.setSong(index);
                }.bind(this, i));
            }
            for(let i = 0; i < this.enabledImages.length; i++) {
                let image = this.enabledImages[i];
                this.appendSimpleListItem(image.name, imageList, function(index) {
                    this.core.setImage(index);
                    this.core.setIsFullAuto(false);
                }.bind(this, i));
            }
        }
        this.updateTotals();
    }

    removePack(pack) {
        let index = this.resourcePacks.indexOf(pack);
        if (index != -1) {
            this.resourcePacks.splice(index, 1);
            this.rebuildArrays();
            this.rebuildEnabled();
        }
    }

    removeAllPacks() {
        this.resourcePacks = [];
        this.rebuildArrays();
        this.rebuildEnabled();
    }

    getSongNames() {
        let names = [];
        for(let i = 0; i < this.allSongs.length; i++) {
            names.push(this.allSongs[i]);
        }
        return names;
    }

    loadLocal() {
        console.log("Loading local zip(s)");

        let files = this.fileInput.files;
        let p = Promise.resolve();
        for(let i = 0; i < files.length; i++) {
            let r = new Respack();
            /*jshint -W083 */
            p = p.then(() => {
                return r.loadFromBlob(files[i], (progress, respack) => {
                    this.localProgress(progress, respack);
                });
            }).then(pack => {
                this.addPack(pack);
                this.localComplete();
            });
        }
        return p.then(() => {
            console.log("Local respack parsing complete");
        });
    }

    localProgress(progress, respack) {
        if(!this.hasUI) {return;}
        this.packsView.progressStatus.textContent = "Processing...";

        this.packsView.progressBar.style.width = (progress * 100) + "%";
        this.packsView.progressCurrent.textContent = respack.filesLoaded;
        this.packsView.progressTop.textContent = respack.filesToLoad;
        this.packsView.progressPercent.textContent = Math.round(progress * 100) + "%";
    }

    localComplete(progress) {
        let progStat = this.packsView.progressStatus;
        progStat.textContent = "Complete";
        window.setTimeout(function() {progStat.textContent = "Idle";}, 2000);

        this.packsView.progressBar.style.width = "100%";
        this.packsView.progressCurrent.textContent = "0b";
        this.packsView.progressTop.textContent = "0b";
        this.packsView.progressPercent.textContent = "0%";
    }

    initUI() {
        this.root = document.createElement("div");
        this.root.className = "respacks";

        let packsContainer = document.createElement("div");
        packsContainer.className = "respacks__manager";

        let packHeader = document.createElement("div");
        packHeader.textContent = "Current respacks";
        packHeader.className = "respacks__header";
        let packList = document.createElement("div");
        packList.className = "resource-list";
        this.packsView.respackList = packList;
        // so we don't use it out of scope in the next if
        let remoteHeader = null;
        let remoteList = null;
        if(!this.core.settings.disableRemoteResources) {
            remoteHeader = document.createElement("div");
            remoteHeader.textContent = "Remote respacks";
            remoteHeader.className = "respacks__header";
            remoteList = document.createElement("div");
            remoteList.className = "resource-list resource-list--fill";
            packList.classList.add("resource-list--fill");
            this.appendSimpleListItem("Click to load the list", remoteList,
                this.loadRemotes.bind(this));
            this.packsView.remoteList = remoteList;
        }

        let buttons = document.createElement("div");
        buttons.className = "respacks-buttons";
        let loadRemote = document.createElement("div");
        loadRemote.className = "hues-button hidden";
        loadRemote.textContent = "LOAD REMOTE";
        loadRemote.onclick = this.loadCurrentRemote.bind(this);
        let loadLocal = document.createElement("div");
        loadLocal.className = "hues-button";
        loadLocal.textContent = "LOAD ZIPS";
        loadLocal.onclick = () => {this.fileInput.click();};
        buttons.appendChild(loadLocal);
        buttons.appendChild(loadRemote);
        this.packsView.loadRemote = loadRemote;

        this.fileInput = document.createElement("input");
        this.fileInput.type ="file";
        this.fileInput.accept="application/zip";
        this.fileInput.multiple = true;
        this.fileInput.onchange = this.loadLocal.bind(this);

        let progressContainer = document.createElement("div");
        progressContainer.className = "progress-container respacks-bottom-container";
        let progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        let progressFilled = document.createElement("span");
        progressFilled.className = "progress-bar--filled";
        progressBar.appendChild(progressFilled);
        let progressStatus = document.createElement("div");
        progressStatus.textContent = "Idle";

        let progressTexts = document.createElement("div");
        progressTexts.className = "stat-text";
        let progressCurrent = document.createElement("div");
        progressCurrent.textContent = "0b";
        let progressTop = document.createElement("div");
        progressTop.textContent = "0b";
        let progressPercent = document.createElement("div");
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
        if(!this.core.settings.disableRemoteResources) {
            packsContainer.appendChild(remoteHeader);
            packsContainer.appendChild(remoteList);
        }
        packsContainer.appendChild(buttons);
        packsContainer.appendChild(progressContainer);

        let indivView = document.createElement("div");
        indivView.className = "respacks__display";

        let packName = document.createElement("div");
        packName.textContent = "<select a respack>";
        packName.className = "respacks__header";
        let packInfo = document.createElement("div");
        packInfo.className = "stat-text";
        let packCreator = document.createElement("div");
        let packCreatorText = document.createElement("a");
        packCreatorText.className = "unstyled-link";
        packCreatorText.textContent = "<author>";
        packCreator.appendChild(packCreatorText);
        packInfo.appendChild(packCreator);
        let packSize = document.createElement("div");
        packSize.textContent = "0b";
        packInfo.appendChild(packSize);
        let packDesc = document.createElement("div");
        packDesc.className = "respack-description";
        packDesc.textContent = "<no description>";

        let tabContainer = document.createElement("div");
        tabContainer.className = "respack-tab-container";

        let songCount = document.createElement("div");
        songCount.textContent = "Songs:";
        songCount.className = "respack-tab respack-tab--checked";

        let imageCount = document.createElement("div");
        imageCount.textContent = "Images:";
        imageCount.className = "respack-tab";

        let songList = document.createElement("div");
        songList.className = "resource-list respack-tab__content respack-tab__content--checked";
        let imageList = document.createElement("div");
        imageList.className = "resource-list respack-tab__content";

        songCount.onclick = () => {
            songCount.classList.add("respack-tab--checked");
            imageCount.classList.remove("respack-tab--checked");

            songList.classList.add("respack-tab__content--checked");
            imageList.classList.remove("respack-tab__content--checked");

            this.currentTab = TAB_SONGS;
        };

        imageCount.onclick = () => {
            imageCount.classList.add("respack-tab--checked");
            songCount.classList.remove("respack-tab--checked");

            imageList.classList.add("respack-tab__content--checked");
            songList.classList.remove("respack-tab__content--checked");

            this.currentTab = TAB_IMAGES;
        };

        let packButtons = document.createElement("div");
        packButtons.className = "respacks-buttons respacks-buttons--fill invisible";
        let enableAll = document.createElement("div");
        enableAll.textContent = "ENABLE ALL";
        enableAll.className = "hues-button";
        enableAll.onclick = this.enableAll.bind(this);
        let invert = document.createElement("div");
        invert.textContent = "INVERT";
        invert.className = "hues-button";
        invert.onclick = this.invert.bind(this);
        let disableAll = document.createElement("div");
        disableAll.textContent = "DISABLE ALL";
        disableAll.className = "hues-button";
        disableAll.onclick = this.disableAll.bind(this);
        packButtons.appendChild(enableAll);
        packButtons.appendChild(invert);
        packButtons.appendChild(disableAll);

        let totalCounts = document.createElement("div");
        totalCounts.className = "respacks-bottom-container";

        let totalSongsCont = document.createElement("div");
        totalSongsCont.className = "respacks-count-container";
        let totalSongsLabel = document.createElement("span");
        totalSongsLabel.textContent = "Total Songs:";
        let totalSongs = document.createElement("span");
        totalSongs.className = "respacks-counts";
        totalSongsCont.appendChild(totalSongsLabel);
        totalSongsCont.appendChild(totalSongs);

        let totalImagesCont = document.createElement("div");
        totalImagesCont.className = "respacks-count-container";
        let totalImagesLabel = document.createElement("span");
        totalImagesLabel.textContent = "Total images:";
        let totalImages = document.createElement("span");
        totalImages.className = "respacks-counts";
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

        tabContainer.appendChild(songCount);
        tabContainer.appendChild(imageCount);
        indivView.appendChild(tabContainer);
        indivView.appendChild(songList);
        indivView.appendChild(imageList);

        indivView.appendChild(packButtons);
        indivView.appendChild(totalCounts);

        this.root.appendChild(packsContainer);
        this.root.appendChild(indivView);

        this.listView = document.createElement("div");
        this.enabledSongList = document.createElement("div");
        this.enabledSongList.className = "resource-list respacks-enabledsongs hidden";
        this.enabledImageList = document.createElement("div");
        this.enabledImageList.className = "resource-list respacks-enabledimages hidden";

        this.listView.appendChild(this.enabledSongList);
        this.listView.appendChild(this.enabledImageList);

        this.hasUI = true;
    }

    hideLists() {
        if(!this.hasUI) {return;}
        this.enabledSongList.classList.add("hidden");
        this.enabledImageList.classList.add("hidden");
    }

    toggleVisible(me, other) {
        if(!this.hasUI) {return;}
        if(me.classList.contains("hidden")) {
            me.classList.remove("hidden");
        } else {
            me.classList.add("hidden");
        }
        other.classList.add("hidden");
    }

    toggleSongList() {
        this.toggleVisible(this.enabledSongList, this.enabledImageList);
    }

    toggleImageList() {
        this.toggleVisible(this.enabledImageList, this.enabledSongList);
    }

    updateTotals() {
        if(!this.hasUI) {return;}
        this.packView.totalSongs.textContent =
                this.enabledSongs.length + "/" + this.allSongs.length;
        this.packView.totalImages.textContent =
                this.enabledImages.length + "/" + this.allImages.length;
    }

    truncateNum(num) {
        return Math.round(num * 100) / 100;
    }

    selectPack(id) {
        let pack = this.resourcePacks[id];
        this.packView.pack = pack;

        this.packView.packButtons.classList.remove("invisible");
        this.packsView.loadRemote.classList.add("hidden");

        this.packView.name.textContent = pack.name;
        this.packView.creator.textContent = pack.author;
        this.packView.creator.href = pack.link ? pack.link : "";
        let size = pack.size / 1024;
        if(size < 512) {
            this.packView.size.textContent = this.truncateNum(size) + "kB";
        } else {
            this.packView.size.textContent = this.truncateNum(size / 1024) + "MB";
        }
        this.packView.desc.textContent = pack.description;
        this.packView.songCount.textContent = "Songs: " + pack.songs.length;
        this.packView.imageCount.textContent = "Images: " + pack.images.length;

        let songList = this.packView.songList;
        let imageList = this.packView.imageList;
        while (songList.firstElementChild) {
            songList.removeChild(songList.firstElementChild);
        }
        while (imageList.firstElementChild) {
            imageList.removeChild(imageList.firstElementChild);
        }

        for(let i = 0; i < pack.songs.length; i++) {
            let song = pack.songs[i];
            this.appendListItem("songs", song.title, "song" + i, songList,
                this.selectResourceCallback(song),
                this.clickResourceCallback.bind(this, song, true),
                song.enabled);
        }

        for(let i = 0; i < pack.images.length; i++) {
            let image = pack.images[i];
            this.appendListItem("images", image.name, "image" + i, imageList,
                this.selectResourceCallback(image),
                this.clickResourceCallback.bind(this, image, false),
                image.enabled);
        }
    }

    selectResourceCallback(res) {
        let self = this;
        return function() {
            res.enabled = this.checked;
            self.rebuildEnabled();
        };
    }

    clickResourceCallback(res, isSong) {
        if(!res.enabled) {
            res.enabled = true;
            this.rebuildEnabled();
            // rebuild display
            this.selectPack(this.resourcePacks.indexOf(this.packView.pack));
        }
        if(isSong) {
            this.core.setSong(this.enabledSongs.indexOf(res));
        } else {
            this.core.setImage(this.enabledImages.indexOf(res));
            this.core.setIsFullAuto(false);
        }
    }

    getEnabledTabContents() {
        let pack = this.packView.pack;
        if(!pack) {
            return null;
        }
        if(this.currentTab == TAB_SONGS) {
            return {arr: pack.songs,
                    elName: "song"};
        } else {
            return {arr: pack.images,
                    elName: "image"};
        }
    }

    enableAll() {
        let tab = this.getEnabledTabContents();
        if(!tab)
            return;
        for(let i = 0; i < tab.arr.length; i++) {
            tab.arr[i].enabled = true;
            document.getElementById(tab.elName + i + "-" + this.unique).checked = true;
        }
        this.rebuildEnabled();
    }

    disableAll() {
        let tab = this.getEnabledTabContents();
        if(!tab)
            return;
        for(let i = 0; i < tab.arr.length; i++) {
            tab.arr[i].enabled = false;
            document.getElementById(tab.elName + i + "-" + this.unique).checked = false;
        }
        this.rebuildEnabled();
    }

    invert() {
        let tab = this.getEnabledTabContents();
        if(!tab)
            return;
        for(let i = 0; i < tab.arr.length; i++) {
            tab.arr[i].enabled = !tab.arr[i].enabled;
            document.getElementById(tab.elName + i + "-" + this.unique).checked = tab.arr[i].enabled;
        }
        this.rebuildEnabled();
    }

    appendListItem(name, value, id, root, oncheck, onclick, checked) {
        if(!this.hasUI) {return;}
        if(checked === undefined) {
            checked = true;
        }
        let div = document.createElement("div");
        div.className = "respacks-listitem";
        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = name;
        checkbox.value = value;
        checkbox.id = id + "-" + this.unique;
        checkbox.checked = checked;
        checkbox.onclick = oncheck;
        let checkStyler = document.createElement("label");
        checkStyler.htmlFor = checkbox.id;
        let label = document.createElement("span");
        label.textContent = value;
        label.onclick = onclick;
        div.appendChild(checkbox);
        div.appendChild(checkStyler);
        div.appendChild(label);
        root.appendChild(div);
    }

    loadRemotes() {
        let remoteList = this.packsView.remoteList;
        while(remoteList.firstElementChild) {
            remoteList.removeChild(remoteList.firstElementChild);
        }
        let item = this.appendSimpleListItem("Loading...", remoteList);

        let req = new XMLHttpRequest();
        req.open('GET', this.core.settings.packsURL, true);
        req.responseType = 'json';
        req.onload = () => {
            if(!req.response) {
                req.onerror();
            }
            this.remotes = req.response;
            this.populateRemotes();
        };
        req.onerror = () => {
            item.textContent = "Could not load list! Click to try again";
            item.onclick = this.loadRemotes.bind(this);
        };
        req.send();
    }

    populateRemotes() {
        let remoteList = this.packsView.remoteList;
        while(remoteList.firstElementChild) {
            remoteList.removeChild(remoteList.firstElementChild);
        }
        for(let i = 0; i < this.remotes.length; i++) {
            this.remotes[i].loaded = false;
            this.appendSimpleListItem(this.remotes[i].name, remoteList,
                function(index) {
                    this.selectRemotePack(index);
                }.bind(this, i));
        }
    }

    selectRemotePack(id) {
        let pack = this.remotes[id];
        this.packView.pack = pack;

        this.packView.packButtons.classList.add("invisible");
        this.packsView.loadRemote.classList.remove("hidden");
        if(pack.loaded) {
            this.packsView.loadRemote.classList.add("hues-button--loaded");
            this.packsView.loadRemote.textContent = "LOADED";
        } else {
            this.packsView.loadRemote.classList.remove("hues-button--loaded");
            this.packsView.loadRemote.textContent = "LOAD REMOTE";
        }

        this.packView.name.textContent = pack.name;
        this.packView.creator.textContent = pack.author;
        this.packView.creator.href = pack.link ? pack.link : "";
        let size = pack.size / 1024;
        if(size < 512) {
            this.packView.size.textContent = this.truncateNum(size) + "kB";
        } else {
            this.packView.size.textContent = this.truncateNum(size / 1024) + "MB";
        }
        this.packView.desc.textContent = pack.description;
        this.packView.songCount.textContent = "Songs: " + pack.songcount;
        this.packView.imageCount.textContent = "Images: " + pack.imagecount;

        let songList = this.packView.songList;
        let imageList = this.packView.imageList;
        while (songList.firstElementChild) {
            songList.removeChild(songList.firstElementChild);
        }
        while (imageList.firstElementChild) {
            imageList.removeChild(imageList.firstElementChild);
        }

        for(let i = 0; i < pack.songs.length; i++) {
            let song = pack.songs[i];
            this.appendSimpleListItem(song, songList);
        }
        let moreSongs = pack.songcount - pack.songs.length;
        if(moreSongs > 0) {
            let text = "... and " + moreSongs + " more song";
            if(moreSongs > 1) {
                text += "s";
            }
            this.appendSimpleListItem(text + ".", songList);
            this.appendSimpleListItem("Load the respack to show the rest!", songList);
        }

        for(let i = 0; i < pack.images.length; i++) {
            let image = pack.images[i];
            this.appendSimpleListItem(image, imageList);
        }
        let moreImages = pack.imagecount - pack.images.length;
        if(moreImages > 0) {
            let text = "... and " + moreImages + " more image";
            if(moreImages > 1) {
                text += "s";
            }
            this.appendSimpleListItem(text + ".", imageList);
            this.appendSimpleListItem("Load the respack to show the rest!", imageList);
        }
    }

    loadCurrentRemote() {
        let pack = this.packView.pack;

        // Not actually a remote, ignore. How did you press this :<
        if(pack.loaded === undefined || pack.loaded) {
            return;
        }

        // TODO Error checking on failure
        pack.loaded = true;
        this.packsView.loadRemote.className = "hues-button hues-button--loaded";
        this.packsView.loadRemote.textContent = "LOADING";
        this.addAll([pack.url], (progress, respack) => {
                this.remoteProgress(progress, respack);
            }
        ).then(this.remoteComplete.bind(this));
    }

    remoteProgress(progress, respack) {
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

    remoteComplete() {
        let progStat = this.packsView.progressStatus;
        progStat.textContent = "Complete";
        window.setTimeout(function() {progStat.textContent = "Idle";}, 2000);
        this.packsView.loadRemote.textContent = "LOADED";

        this.packsView.progressBar.style.width = "100%";
        this.packsView.progressCurrent.textContent = "0b";
        this.packsView.progressTop.textContent = "0b";
        this.packsView.progressPercent.textContent = "0%";
    }

    appendSimpleListItem(value, root, onclick) {
        let div = document.createElement("div");
        div.className = "respacks-listitem";
        let label = document.createElement("span");
        // Because we're using textContent, we replace with literal &
        label.textContent = value.replace(/&amp;/g, '&');
        label.onclick = onclick;
        div.appendChild(label);
        root.appendChild(div);
        return label;
    }
}

window.Resources = Resources;

})(window, document);