import '../css/hues-respacks.css';
import { Respack, type HuesImage, type HuesSong, type ProgressCallback } from './ResourcePack';
import type { HuesCore } from './HuesCore';
import type HuesWindow from './HuesWindow';

let TAB_SONGS = 0;
let TAB_IMAGES = 1;

// For multiple Hues on one page
let unique = 0;
let getAndIncrementUnique = function() {
    return unique++;
};

interface RemotePack extends Respack {
    loaded?: boolean;
    url: string;
}

export default class Resources {
    core: HuesCore;
    hasUI: boolean;

    resourcePacks: Respack[];

    allSongs: HuesSong[];
    allImages: HuesImage[];
    enabledSongs: HuesSong[];
    enabledImages: HuesImage[];

    progressState: number[];
    progressCallback?: ProgressCallback;

    // oh god oh man there's so much UI I need to svelte-ify this
    root!: HTMLDivElement;
    enabledSongList!: HTMLDivElement;
    enabledImageList!: HTMLDivElement;
    listView!: HTMLDivElement;

    packView!: {
        pack: Respack;
        name: HTMLDivElement;
        creator: HTMLAnchorElement;
        size: HTMLDivElement;
        desc: HTMLDivElement;
        songCount: HTMLDivElement;
        imageCount: HTMLDivElement;
        songList: HTMLDivElement;
        imageList: HTMLDivElement;
        packButtons: HTMLDivElement;
        totalSongs: HTMLSpanElement;
        totalImages: HTMLSpanElement;
    };

    packsView!: {
        respackList: HTMLDivElement;
        remoteList: HTMLDivElement;
        loadRemote: HTMLDivElement;
        progressBar: HTMLSpanElement;
        progressStatus: HTMLDivElement;
        progressCurrent: HTMLDivElement;
        progressTop: HTMLDivElement;
        progressPercent: HTMLDivElement;
    }

    fileInput!: HTMLInputElement;

    currentTab: number;
    unique: number;
    remotes: any;

    constructor(core: HuesCore, huesWin: HuesWindow) {
        this.core = core;
        this.hasUI = false;

        this.resourcePacks = [];

        this.allSongs = [];
        this.allImages = [];
        this.enabledSongs = [];
        this.enabledImages = [];

        this.progressState = [];

        this.currentTab = TAB_SONGS;
        this.unique = getAndIncrementUnique();
        this.remotes = null;
        if(core.settings.enableWindow) {
            this.initUI();
            huesWin.addTab("RESOURCES", this.root);
        }
    }

    /* Uses HTTP HEAD requests to get the size of all the linked URLs
       Returns an Promise.all which will resolve to an array of sizes */
    getSizes(urls: string[]) {
        let promises: Promise<number | null>[] = [];

        urls.forEach(url => {
            let p = new Promise<number | null>((resolve, reject) => {
                let xhr = new XMLHttpRequest();
                xhr.open("HEAD", url, true);
                xhr.onreadystatechange = function() {
                    if (this.readyState == this.DONE) {
                        let len = xhr.getResponseHeader("Content-Length");
                        if(len === null) {
                            resolve(null);
                            return;
                        }
                        let bytes = parseInt(len);
                        resolve(bytes / 1024 / 1024);
                    }
                };
                xhr.onerror = function() {
                    reject(Error(xhr.status + ": Could not fetch respack at " + url));
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
    addAll(urls: string[], progressCallback: ProgressCallback) {
        if(progressCallback) {
            this.progressCallback = progressCallback;
            this.progressState = Array.apply(null, Array(urls.length)).map(Number.prototype.valueOf,0);
        }

        let respackPromises = [];

        for(let i = 0; i < urls.length; i++) {
            let progressFunc = (progress: number, pack: Respack) => {
                this.progressState[i] = progress;
                this.updateProgress(pack);
            };

            let r = new Respack();
            respackPromises.push(r.loadFromURL(urls[i], progressFunc));
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

    updateProgress(pack: Respack) {
        let total = 0;
        for(const state of this.progressState) {
            total += state;
        }
        total /= this.progressState.length;

        if(this.progressCallback) {
            this.progressCallback(total, pack);
        }
    }

    addPack(pack: Respack) {
        console.log("Added", pack.name, "to respacks");
        let id = this.resourcePacks.length;
        this.resourcePacks.push(pack);
        this.addResourcesToArrays(pack);
        this.rebuildEnabled();
        this.updateTotals();

        if(this.core.settings.enableWindow) {
            this.appendListItem("respacks", pack.name, "res" + id, this.packsView.respackList,
                checked => {
                    pack.enabled = checked;
                    this.rebuildEnabled();
                },
                () => this.selectPack(id));
        }
    }

    addResourcesToArrays(pack: Respack) {
        this.allImages = this.allImages.concat(pack.images);
        this.allSongs = this.allSongs.concat(pack.songs);
    }

    rebuildArrays() {
        this.allSongs = [];
        this.allImages = [];

        for(const pack of this.resourcePacks) {
            this.addResourcesToArrays(pack);
        }
    }

    rebuildEnabled() {
        this.enabledSongs = [];
        this.enabledImages = [];

        for(const pack of this.resourcePacks) {
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
            for(const [i, song] of this.enabledSongs.entries()) {
                this.appendSimpleListItem(song.title!, songList, () => {
                    this.core.setSong(i);
                });
            }
            for(const [i, image] of this.enabledImages.entries()) {
                this.appendSimpleListItem(image.name, imageList, () => {
                    this.core.setImage(i);
                    this.core.setIsFullAuto(false);
                });
            }
        }
        this.updateTotals();
    }

    removePack(pack: Respack) {
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
        for(const song of this.allSongs) {
            names.push(song);
        }
        return names;
    }

    loadLocal() {
        console.log("Loading local zip(s)");

        let files = this.fileInput.files;
        if(!files) {
            console.log("...empty or null");
            return Promise.resolve();
        }

        let p = Promise.resolve();
        for(const file of files) {
            let r = new Respack();
            p = p.then(() => {
                return r.loadFromBlob(file, (progress, respack) => {
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

    localProgress(progress: number, respack: Respack) {
        if(!this.hasUI) {return;}
        this.packsView.progressStatus.textContent = "Processing...";

        this.packsView.progressBar.style.width = (progress * 100) + "%";
        this.packsView.progressCurrent.textContent = respack.filesLoaded.toString();
        this.packsView.progressTop.textContent = respack.filesToLoad.toString();
        this.packsView.progressPercent.textContent = Math.round(progress * 100) + "%";
    }

    localComplete() {
        let progStat = this.packsView.progressStatus;
        progStat.textContent = "Complete";
        window.setTimeout(function() {progStat.textContent = "Idle";}, 2000);

        this.packsView.progressBar.style.width = "100%";
        this.packsView.progressCurrent.textContent = "0b";
        this.packsView.progressTop.textContent = "0b";
        this.packsView.progressPercent.textContent = "0%";
    }

    initUI() {
        (<any>this.packView) = {};
        (<any>this.packsView) = {};

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
            packsContainer.appendChild(remoteHeader!);
            packsContainer.appendChild(remoteList!);
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

    toggleVisible(me: HTMLElement, other: HTMLElement) {
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

    truncateNum(num: number) {
        return Math.round(num * 100) / 100;
    }

    selectPack(id: number) {
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

        for(const [i, song] of pack.songs.entries()) {
            let song = pack.songs[i];
            this.appendListItem("songs", song.title || "", "song" + i, songList,
                checked => this.selectResourceCallback(song, checked),
                () => this.clickResourceCallback(song, true),
                song.enabled);
        }

        for(const [i, image] of pack.images.entries()) {
            this.appendListItem("images", image.name, "image" + i, imageList,
                checked => this.selectResourceCallback(image, checked),
                () => this.clickResourceCallback(image, false),
                image.enabled);
        }
    }

    selectResourceCallback(res: HuesSong | HuesImage, checked: boolean) {
        res.enabled = checked;
        this.rebuildEnabled();
    }

    clickResourceCallback(res: HuesSong | HuesImage, isSong: boolean) {
        if(!res.enabled) {
            res.enabled = true;
            this.rebuildEnabled();
            // rebuild display
            this.selectPack(this.resourcePacks.indexOf(this.packView.pack));
        }
        if(isSong) {
            this.core.setSong(this.enabledSongs.indexOf(res as HuesSong));
        } else {
            this.core.setImage(this.enabledImages.indexOf(res as HuesImage));
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

    setAll(valCallback: (previousVal: boolean) => boolean) {
        let tab = this.getEnabledTabContents();
        if(!tab)
            return;
        for(const [i, entry] of tab.arr.entries()) {
            const newVal = valCallback(entry.enabled);
            entry.enabled = newVal;
            let checkbox = document.getElementById(tab.elName + i + "-" + this.unique);
            (<HTMLInputElement>checkbox).checked = newVal;
        }
        this.rebuildEnabled();
    }

    enableAll() {
        this.setAll(() => true);
    }

    disableAll() {
        this.setAll(() => false);
    }

    invert() {
        this.setAll((prev) => !prev);
    }

    appendListItem(name: string, value: string, id: string, root: HTMLElement,
            oncheck: (checked: boolean) => any, onclick: GlobalEventHandlers['onclick'],
            checked: boolean = true) {
        if(!this.hasUI) {return;}

        let div = document.createElement("div");
        div.className = "respacks-listitem";
        let checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = name;
        checkbox.value = value;
        checkbox.id = id + "-" + this.unique;
        checkbox.checked = checked;
        checkbox.onclick = () => oncheck(checkbox.checked);
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

        let onerror = () => {
            item.textContent = "Could not load list! Click to try again";
            item.onclick = this.loadRemotes.bind(this);
        };

        let req = new XMLHttpRequest();
        req.open('GET', this.core.settings.packsURL, true);
        req.responseType = 'json';
        req.onload = () => {
            if(!req.response) {
                onerror();
            }
            this.remotes = req.response;
            this.populateRemotes();
        };
        req.onerror = onerror;
        req.send();
    }

    populateRemotes() {
        let remoteList = this.packsView.remoteList;
        while(remoteList.firstElementChild) {
            remoteList.removeChild(remoteList.firstElementChild);
        }
        for(const [i, remote] of this.remotes.entries()) {
            remote.loaded = false;
            this.appendSimpleListItem(remote.name, remoteList,
                () => {this.selectRemotePack(i)});
        }
    }

    selectRemotePack(id: number) {
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
        let pack = this.packView.pack as RemotePack;

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

    remoteProgress(progress: number, respack: Respack) {
        if(progress < 0.5) {
            this.packsView.progressStatus.textContent = "Downloading...";
            this.packsView.progressCurrent.textContent = Math.round(respack.downloaded / 1024) + "b";
            this.packsView.progressTop.textContent = Math.round(respack.size / 1024) + "b";
            this.packsView.progressBar.style.width = (progress * 2 * 100) + "%";
            this.packsView.progressPercent.textContent = Math.round(progress * 2 * 100) + "%";
        } else {
            this.packsView.progressStatus.textContent = "Processing...";
            this.packsView.progressCurrent.textContent = respack.filesLoaded.toString();
            this.packsView.progressTop.textContent = respack.filesToLoad.toString();
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

    appendSimpleListItem(value: string, root: HTMLElement, onclick?: GlobalEventHandlers['onclick']) {
        let div = document.createElement("div");
        div.className = "respacks-listitem";
        let label = document.createElement("span");
        // Because we're using textContent, we replace with literal &
        label.textContent = value.replace(/&amp;/g, '&');
        if(onclick) {
            label.onclick = onclick;
        }
        div.appendChild(label);
        root.appendChild(div);
        return label;
    }
}
