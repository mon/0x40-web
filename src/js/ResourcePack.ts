import type { EditorUndoRedo } from "./HuesEditor";

import * as zip from "@zip.js/zip.js";
import { BeatTypes, Effect, ImageColour } from "./HuesCore";

export class HuesSongSection {
    // Any section will have at least one bank with some beats in it. If a song
    // is lacking a section, its HuesSongSection should instead be undefined.
    banks: string[];
    // a single string containing the best-effort flattened banks to their
    // closest characters
    beatString: string;
    // The raw soundfile contents
    sound?: ArrayBuffer;
    // The raw filename of the audio - eg: finale_loop.mp3
    protected fname?: string;

    constructor(absPath?: string, sound?: ArrayBuffer) {
        this.banks = ["."];
        this.beatString = '.';

        this.sound = sound;
        if(absPath) {
            this.filename = absPath;
        }
    }

    set filename(path: string | undefined) {
        if(!path) {
            this.fname = path;
            return;
        }

        const parts = path.split('/');
        this.fname = parts.pop() || path;
    }

    get filename() {
        return this.fname;
    }

    // the name of the audio file, with no extension - eg: finale_loop
    get basename(): string | undefined {
        if(!this.filename) {
            return undefined;
        }
        // don't do a generic extension pop since audio extensions are checked
        // when parsing
        return this.filename.replace(audioExtensions, "");
    }

    // get the beatmap length - all banks have the same length
    get mapLen() {
        return this.banks[0].length;
    }

    private effectsToBits(effects: Effect[]) {
        let ret = 0;
        for(const eff of effects) {
            ret |= 1 << eff;
        }
        return ret;
    }

    // https://stackoverflow.com/a/43122214/7972801
    private bitCount(n: number) {
        var bits = 0
        while (n !== 0) {
            bits += this.bitCount32(n | 0)
            n /= 0x100000000
        }
        return bits
    }
    private bitCount32(n: number) {
        n = n - ((n >> 1) & 0x55555555)
        n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
        return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
    }

    // update the best-effort flattening of the banks, since this is somewhat
    // intensive I guess and doesn't have to be dynamically done each frame.
    // It could certainly be optimised, but I think it should be fine
    recalcBeatString() {
        if(this.banks.length == 1) {
            this.beatString = this.banks[0];
            return;
        }

        let beatBits: {[beat: number]: string} = {};
        for(const [char, effects] of Object.entries(BeatTypes)) {
            beatBits[this.effectsToBits(effects)] = char;
        }

        let ret = "";
        for(let i = 0; i < this.mapLen; i++) {
            let bits = 0;
            for(const bank of this.banks) {
                const beat = bank[i];
                const effects : Effect[] = (BeatTypes as any)[beat] ?? ImageColour;
                bits |= this.effectsToBits(effects);
            }

            const exactMatch = beatBits[bits];
            if(exactMatch !== undefined) {
                ret += exactMatch;
                continue;
            }

            // we have to find the closest match
            // XOR and count the ones to see how different each target char is
            // from the effects being used
            let closest = '.';
            let best = null;
            for(const [compare, char] of Object.entries(beatBits)) {
                const diff = this.bitCount(+compare ^ bits);
                if(best === null || diff < best) {
                    best = diff;
                    closest = char;
                }
            }
            ret += closest;
        }

        this.beatString = ret;
    }

    // should not ever throw outside of development
    checkConsistency() {
        if(this.mapLen <= 0) {
            throw "SongSection has no bank data!";
        }

        for(const bank of this.banks) {
            if(bank.length != this.mapLen) {
                throw "SongSection bank length consistency check failure!";
            }
        }
    }

    // For a given index, return a string with every bank's beat characters
    // eg: banks ['abc', 'def', 'ghi'] at index 1 returns ['b', 'e', 'h']
    beatsAt(index: number): string[] {
        let ret = [];
        for(const bank of this.banks) {
            ret.push(bank[index]);
        }

        return ret;
    }

    removeBank(index: number) {
        if(this.banks.length > 1) {
            this.banks.splice(index, 1);
        }
    }

    addBank() {
        this.banks.push('.'.repeat(this.mapLen));
    }
}

export class HuesSong {
    title : string;
    // loop/build should have identical # of banks, and each bank should be the
    // same length. Not enforcing this programmatically is probably going to
    // blow up in my face later
    loop: HuesSongSection;
    build?: HuesSongSection;
    source: string;
    charsPerBeat: number | null;
    independentBuild: boolean;
    // runtime
    enabled: boolean;
    buildupPlayed: boolean;
    // editor
    undoQueue?: EditorUndoRedo[];
    redoQueue?: EditorUndoRedo[];
    // putting this here lets it persist across song change, which is neat
    hiddenBanks: boolean[];

    constructor(title?: string, loopFilename?: string) {
        this.title = title || "";
        this.loop = new HuesSongSection(loopFilename);
        this.source = "";
        this.charsPerBeat = null;
        this.independentBuild = false;

        this.enabled = true;
        this.buildupPlayed = false;
        // exploit default-undefined being false
        this.hiddenBanks = [];
    }

    get bankCount() {
        return this.loop.banks.length;
    }

    removeBank(index: number) {
        this.loop.removeBank(index);
        this.build?.removeBank(index);
        this.hiddenBanks.splice(index, 1);
        this.checkConsistency();
    }

    addBank() {
        this.loop.addBank();
        this.build?.addBank();
        this.hiddenBanks[this.bankCount] = false; // new bank is always visible
        this.checkConsistency();
    }

    recalcBeatStrings() {
        this.loop.recalcBeatString();
        this.build?.recalcBeatString();
    }

    // should not ever throw outside of development
    checkConsistency() {
        if(this.build && this.build.banks.length != this.loop.banks.length) {
            throw "Song bank lengths are mismatched!";
        }
        this.loop.checkConsistency();
        this.build?.checkConsistency();
    }
}

export interface HuesImage {
    name: string;
    fullname: string;
    align: "center" | "left" | "right";
    bitmaps: HTMLImageElement[];
    frameDurations :number[];
    source: string;
    enabled: boolean;
    animated: boolean;
    beatsPerAnim: number;
    syncOffset?: number;
}

export type ProgressCallback = (percent: number, respack: Respack) => void;

const debugConsole = false;
function debug(...args: any[]) {
    if(debugConsole) {
        console.log(...args);
    }
}

const audioExtensions = new RegExp("\\.(mp3|ogg|wav)$", "i");
const imageExtensions = new RegExp("\\.(png|gif|jpg|jpeg)$", "i");

type ImageParseResult = {
    bitmap: string; // base64 data URI
    img: HuesImage;
}

function basename(entry: zip.Entry) {
    const fullname = entry.filename;
    const parts = fullname.split('/');
    return parts.pop() || fullname;
}

export class Respack {
    songs: HuesSong[];
    songQueue: Promise<void>[];
    images: HuesImage[];
    imageQueue: Promise<ImageParseResult>[];

    name: string;
    author: string;
    description: string;
    link: string;

    size: number;
    downloaded: number;
    enabled: boolean;

    _xmlQueue: Promise<Document>[];

    totalFiles: number;

    // For zip parsing progress events
    progressCallback: null | ProgressCallback;
    filesToLoad: number;
    filesLoaded: number;
    loadedFromURL: boolean;

    constructor() {
        this.songs = [];
        this.songQueue = [];
        this.images = [];
        this.imageQueue = [];

        this.name = "<no name>";
        this.author = "<unknown>";
        this.description = "<no description>";
        this.link = "";

        this.size = -1;
        this.downloaded = -1;
        this.enabled = true;

        this._xmlQueue = [];

        this.totalFiles = -1;

        this.progressCallback = null;
        this.filesToLoad = 0;
        this.filesLoaded = 0;
        this.loadedFromURL = false;
    }

    updateProgress(override?: number) {
        if(this.progressCallback) {
            let percent = this.filesLoaded / this.filesToLoad;
            if(this.loadedFromURL) {
                percent = (percent / 2) + 0.5;
            }
            this.progressCallback(override === undefined ? percent : override, this);
        }
    }

    loadFromURL(url: string, progress: ProgressCallback) {
        this.loadedFromURL = true;
        if(progress) {
            this.progressCallback = progress;
        }

        return this.getBlob(url)
        .then(response => {
            return this.loadFromBlob(response);
        });
    }

    getBlob(url: string, progress?: ProgressCallback): Promise<Blob> {
        if(progress !== undefined) {
            this.progressCallback = progress;
        }
        return new Promise<Blob>((resolve, reject) => {
            let req = new XMLHttpRequest();
            req.open('GET', url, true);
            req.responseType = 'blob';
            req.onload = () => {
                if(req.status == 200) {
                    resolve(req.response);
                } else {
                    reject(Error(req.status + ": Could not fetch respack at " + url));
                }
            };
            req.onerror = function() {
                reject(Error(req.status + ": Could not fetch respack at " + url));
            };
            req.onprogress = event => {
                if (event.lengthComputable) {
                    this.size = event.total;
                    this.downloaded = event.loaded;
                    let percent = event.loaded / event.total;
                    if(this.progressCallback) {
                        this.progressCallback(percent / 2, this); // because of processing too
                    }
                }
            };
            req.send();
        }).catch(error => {
            // Infinitely more user friendly than the error Same Origin gives
            if(error.code == 1012) {
                throw Error("Respack at URL " + url + " is restricted. Check CORS.");
            } else {
                throw error;
            }
        });
    }

    async loadFromBlob(blob: Blob, progress?: ProgressCallback) {
        if(progress !== undefined) {
            this.progressCallback = progress;
        }
        this.updateProgress(this.loadedFromURL ? 0.5 : 0);
        this.size = blob.size;

        const file = new zip.ZipReader(new zip.BlobReader(blob));
        try {
            const entries = await file.getEntries();
            await this.parseZip(entries);

            return this;
        } catch(error: any) {
            console.error(error); // more details
            throw Error("Respack error:" + error);
        };
    }

    parseZip(entries: zip.Entry[]) {
        this.totalFiles = 0;
        // Progress events
        this.filesToLoad = 0;
        this.filesLoaded = 0;

        // Get everything started
        for(const file of entries) {
            if(!file.directory && file.filename) {
                this.totalFiles++;
                this.parseFile(file);
            }
        }

        return this.parseSongQueue()
        .then(() => {
            return this.parseImageQueue();
        }).then(() => {
            return this.parseXML();
        }).then(() => {
            // Cleanup
            this._xmlQueue = [];
            console.log("Loaded", this.name, "successfully with", this.songs.length,
                        "songs and", this.images.length, "images.");
        });
    }

    parseFile(file: zip.Entry) {
        let name = basename(file);
        if (name.match(audioExtensions)) {
            this.songQueue.push(this.parseSong(file));
            this.filesToLoad++;
        } else if (name.match(imageExtensions)) {
            let parse = this.parseImage(file);
            if(parse) {
                this.imageQueue.push(parse);
                this.filesToLoad++;
            }
        } else if(name.toLowerCase().endsWith(".xml")){
            this._xmlQueue.push(this.loadXML(file));
        }
    }

    async parseSong(file: zip.Entry): Promise<void> {
        let newSong = new HuesSong("", file.filename);

        debug("parsing song: " + newSong.loop.filename);

        const oldSong = this.getSong(newSong.loop.basename);
        if (oldSong) {
            console.warn("Song", newSong.loop.filename, "already exists! Conflict with " + oldSong);
        } else {
            this.songs.push(newSong);

            let arr = await file.getData!(new zip.Uint8ArrayWriter()) as Uint8Array;
            newSong.loop.sound = arr.buffer;
            this.filesLoaded++;
            this.updateProgress();
        }
    }

    parseSongQueue() {
        return this.songQueue.reduce((sequence, songPromise) => {
            return sequence.then(() => {
                // Maintain order
                return songPromise;
            });
        }, Promise.resolve());
    }

    parseImage(file: zip.Entry) {
        let match;
        let name = basename(file).replace(imageExtensions, "");
        let img: HuesImage | null;

        // Animation
        if((match = name.match(new RegExp("^(.*)_(\\d+)$")))) {
            img = this.getImage(match[1]);
            if(!img) { // make a fresh one
                img = {
                    name:match[1],
                    fullname:match[1],
                    align:"center",
                    bitmaps:[],
                    frameDurations:[33],
                    source:"",
                    enabled:true,
                    animated:true,
                    beatsPerAnim: 0
                };
                this.images.push(img);
            }
        // Normal image
        } else if (!this.containsImage(name)) {
            img = {
                name:name,
                fullname:name,
                align:"center",
                bitmaps:[],
                frameDurations:[33],
                source:"",
                enabled:true,
                animated:false,
                beatsPerAnim: 0
            };
            this.images.push(img);
        } else {
            let existing = this.getImage(name);
            console.log("WARNING: Image", name, "already exists! Conflict with", basename(file), "and", existing?.name);
            return;
        }

        return this.loadImage(file, img);
    }

    async loadImage(imgFile: zip.Entry, imageObj: HuesImage): Promise<ImageParseResult> {
        let mime = "";
        const extension = imgFile.filename.split('.').pop()!.toLowerCase();
        switch(extension) {
            case "png":
                mime = "image/png";
                break;
            case "gif":
                mime = "image/gif";
                break;
            case "jpg":
            case "jpeg":
                mime = "image/jpeg";
                break;
            default:
                mime = "application/octet-stream";
        }
        let bitmap = await imgFile.getData!(new zip.Data64URIWriter(mime)) as string;
        this.filesLoaded++;
        this.updateProgress();
        return {bitmap: bitmap, img: imageObj};
    }

    parseImageQueue() {
        return this.imageQueue.reduce((sequence, imagePromise) => {
            return sequence.then(() => {
                // Maintain order
                return imagePromise;
            }).then(response => {
                // Don't crash if the respack had duplicate images
                if(!response)
                    return;
                let newImg = new Image();
                newImg.src = response.bitmap;
                response.img.bitmaps.push(newImg);
            });
        }, Promise.resolve());
    }

    async loadXML(file: zip.Entry) {
        let text = await file.getData!(new zip.TextWriter()) as string;

        let parser = new DOMParser();
        let dom = parser.parseFromString(text, "text/xml");

        // this is some real PHP-tier error reporting from this API
        if(dom.querySelector('parsererror')) {
            console.log("Respack parse failed, attempting ampersand sanitisation");
            // Some respacks don't properly escape ampersands, which trips
            // up the XML parser - so just escape them all and try again.
            // Respacks that correctly escape *other* elements (like &lt;
            // and &gt;) will also properly escape ampersands, so this
            // should be OK and not result in "&amp;&lt;" nonsense.
            text = text.replace(/&amp;/g, '&');
            text = text.replace(/&/g, '&amp;');
            console.log(text);
            dom = parser.parseFromString(text, "text/xml");
        }

        return dom
    }

    async parseXML() {
        // don't let a bad parse leave us with a bunch of dummy songs
        let seenSongXml = false;

        let queue = []
        for(let i = 0; i < this._xmlQueue.length; i++) {
            queue.push(this._xmlQueue[i].then(dom => {
                switch(dom.documentElement.nodeName) {
                    case "songs":
                            if(this.songs.length > 0) {
                                seenSongXml = true;
                                this.parseSongFile(dom);
                            }
                        break;
                    case "images":
                        if(this.images.length > 0)
                                this.parseImageFile(dom);
                        break;
                    case "info":
                            this.parseInfoFile(dom);
                        break;
                    default:
                            console.warn("XML found with no <songs>, <images> or <info> tag");
                        break;
                }
            }));
        }
        await Promise.all(queue);

        if(this.songs.length > 0 && !seenSongXml) {
            this.songs = [];
            console.warn("Songs present in respack \"" + this.name + "\" but no XML to describe them");
        }
    }

    loadExtraCharts(el: Element, section: HuesSongSection, tagPrefix: string, expected?: number) {
        for(let i = 2; true; i++) {
            let extraChart = el.getTag(tagPrefix + i);
            if(extraChart === null) {
                break;
            }

            if(extraChart.length < section.mapLen) {
                console.warn(tagPrefix + i + " is shorter than primary " + tagPrefix + ", padding with '.'");
                extraChart += ".".repeat(section.mapLen - extraChart.length);
            } else if(extraChart.length > section.mapLen) {
                console.warn(tagPrefix + i + " is longer than primary " + tagPrefix + ", truncating");
                extraChart = extraChart.slice(0, section.mapLen);
            }

            section.banks.push(extraChart);
        }

        if(expected && section.banks.length != expected) {
            console.warn("Should have seen", expected, tagPrefix, "sections, but found", section.banks.length);
            if(section.banks.length < expected) {
                console.warn("Adding empty banks to fit");
                for(let i = section.banks.length; i < expected; i++) {
                    section.banks.push(".".repeat(section.mapLen));
                }
            } else {
                console.warn("Deleting excess banks");
                section.banks = section.banks.slice(0, expected);
            }
        }
    }

    parseSongFile(dom: Document) {
        debug(" - Parsing songFile");

        let newSongs = [];
        for(const el of dom.documentElement.children) {
            let song = this.getSong(el.getAttribute("name"));
            if(song) {
                song.title = el.getTag("title") || "";
                if(!song.title) {
                    song.title = "<no name>";
                    console.warn(song.loop.basename, "has no title!");
                }

                let chart = el.getTag("rhythm");
                if(chart === null) {
                    chart = "..no..rhythm..";
                    console.warn(song.loop.basename, "has no rhythm!!");
                }
                song.loop.banks = [chart];
                this.loadExtraCharts(el, song.loop, "rhythm");

                const buildName = el.getTag("buildup") || undefined;
                if(buildName) {
                    debug("  Finding a buildup '" + buildName + "' for ", song.loop.basename);
                    let build = this.getSong(buildName);
                    if(build) {
                        // migrate this from loop to build
                        song.build = build.loop;
                        // get rid of the junk
                        this.songs.splice(this.songs.indexOf(build), 1);

                        let buildChart = el.getTag("buildupRhythm");
                        if(buildChart === null) {
                            buildChart = ".";
                            console.warn(song.loop.basename, "has no buildup, despite having a buildup sound!!");
                        }
                        song.build.banks = [buildChart];
                        this.loadExtraCharts(el, song.build, "buildupRhythm", song.loop.banks.length);
                    } else {
                        console.warn("Didn't find a buildup '" + buildName + "'!");
                    }
                }

                song.independentBuild = !!el.getTag("independentBuild");
                song.source = el.getTag("source") || "";
                song.charsPerBeat = parseFloat(el.getTag("charsPerBeat") || "0");

                song.recalcBeatStrings();
                song.checkConsistency();
                newSongs.push(song);
                debug("  [I] " + song.loop.basename, ": '" + song.title + "' added to songs");
            } else {
                console.warn("songs.xml: <song> element" + el.getAttribute("name") + "- no song found");
            }
        }
        for(let i = 0; i < this.songs.length; i++) {
            if(newSongs.indexOf(this.songs[i]) == -1) {
                console.warn("We have a file for", this.songs[i].loop.basename, "but no information for it");
            }
        }
        this.songs = newSongs;
    }

    parseInfoFile(dom: Document) {
        debug(" - Parsing infoFile");

        let info = dom.documentElement;

        // self reference strings to avoid changing strings twice in future
        this.name = info.getTag("name", this.name)!;
        this.author = info.getTag("author", this.author)!;
        this.description = info.getTag("description", this.description)!;
        this.link = info.getTag("link", this.link)!;
    }

    parseImageFile(dom: Document) {
        debug(" - Parsing imagefile");

        let newImages = [];
        for(const el of dom.documentElement.children) {
            let image = this.getImage(el.getAttribute("name"));
            if(image) {
                image.fullname = el.getTag("fullname") || "";
                if(!image.fullname) {
                    console.warn(image.name, "has no full name!");
                }
                image.source = el.getTag("source") || "";
                // self reference defaults to avoid changing strings twice in future
                image.align = el.getTag("align", image.align)! as HuesImage["align"];
                image.beatsPerAnim = parseFloat(el.getTag("beatsPerAnim") || "0");
                image.syncOffset = parseFloat(el.getTag("syncOffset") || "0");
                let frameDur = el.getTag("frameDuration");
                if(frameDur) {
                    image.frameDurations = [];
                    let strSplit = frameDur.split(",");
                    for(let j = 0; j < strSplit.length; j++) {
                        image.frameDurations.push(parseInt(strSplit[j]));
                    }
                    while (image.frameDurations.length < image.bitmaps.length) {
                        image.frameDurations.push(image.frameDurations[image.frameDurations.length - 1]);
                    }
                    debug("Frame durations:", image.frameDurations);
                }
                debug("  [I] " + image.name, ":", image.fullname, "added to images");
                if (image.bitmaps.length) {
                    newImages.push(image);
                }
                else {
                    console.warn("Image", image.name, "has no bitmap nor animation frames!");
                }
            } else {
                console.warn("images.xml: no image '" + el.getAttribute("name") + "' found");
            }
        }
        for(let i = 0; i < this.images.length; i++) {
            let image = this.images[i];
            // Add all images with no info
            if(newImages.indexOf(image) == -1) {
                newImages.push(image);
            }
        }
        newImages.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });
        this.images = newImages;
    }

    containsSong(name: string) {
        return this.getSong(name) !== null;
    }

    containsImage(name: string) {
        return this.getImage(name) !== null;
    }

    getSong(name: string | undefined | null): null | HuesSong {
        for(let song of this.songs) {
            if (name == song.loop.basename) {
                return song;
            }
        }
        return null;
    }

    getImage(name: string | null): null | HuesImage {
        for(let image of this.images) {
            if (name == image.name) {
                return image;
            }
        }
        return null;
    }
}

declare global {
    interface Element {
        getTag: (tag: string, def?: string) => string | null;
    }
}

// Save some chars
Element.prototype.getTag = function<D extends string>(tag: string, def?: D): string | null {
    let t = this.getElementsByTagName(tag)[0];
    return t ? t.textContent : (def ? def : null);
};
