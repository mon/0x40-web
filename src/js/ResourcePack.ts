import type { EditorUndoRedo } from "./HuesEditor";

import * as zip from "@zip.js/zip.js";
import xmlbuilder from "xmlbuilder";
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
    this.beatString = ".";

    this.sound = sound;
    if (absPath) {
      this.filename = absPath;
    }
  }

  set filename(path: string | undefined) {
    if (!path) {
      this.fname = path;
      return;
    }

    const parts = path.split("/");
    this.fname = parts.pop() || path;
  }

  get filename() {
    return this.fname;
  }

  // the name of the audio file, with no extension - eg: finale_loop
  get basename(): string | undefined {
    if (!this.filename) {
      return undefined;
    }
    return plainName(this.filename);
  }

  // get the beatmap length - all banks have the same length
  get mapLen() {
    return this.banks[0].length;
  }

  private effectsToBits(effects: Effect[]) {
    let ret = 0;
    for (const eff of effects) {
      ret |= 1 << eff;
    }
    return ret;
  }

  // https://stackoverflow.com/a/43122214/7972801
  private bitCount(n: number) {
    var bits = 0;
    while (n !== 0) {
      bits += this.bitCount32(n | 0);
      n /= 0x100000000;
    }
    return bits;
  }
  private bitCount32(n: number) {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
  }

  // update the best-effort flattening of the banks, since this is somewhat
  // intensive I guess and doesn't have to be dynamically done each frame.
  // It could certainly be optimised, but I think it should be fine
  recalcBeatString() {
    if (this.banks.length == 1) {
      this.beatString = this.banks[0];
      return;
    }

    let beatBits: { [beat: number]: string } = {};
    for (const [char, effects] of Object.entries(BeatTypes)) {
      beatBits[this.effectsToBits(effects)] = char;
    }

    let ret = "";
    for (let i = 0; i < this.mapLen; i++) {
      let bits = 0;
      for (const bank of this.banks) {
        const beat = bank[i];
        const effects: Effect[] = (BeatTypes as any)[beat] ?? ImageColour;
        bits |= this.effectsToBits(effects);
      }

      const exactMatch = beatBits[bits];
      if (exactMatch !== undefined) {
        ret += exactMatch;
        continue;
      }

      // we have to find the closest match
      // XOR and count the ones to see how different each target char is
      // from the effects being used
      let closest = ".";
      let best = null;
      for (const [compare, char] of Object.entries(beatBits)) {
        const diff = this.bitCount(+compare ^ bits);
        if (best === null || diff < best) {
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
    if (this.mapLen <= 0) {
      throw "SongSection has no bank data!";
    }

    for (const bank of this.banks) {
      if (bank.length != this.mapLen) {
        throw "SongSection bank length consistency check failure!";
      }
    }
  }

  // For a given index, return a string with every bank's beat characters
  // eg: banks ['abc', 'def', 'ghi'] at index 1 returns ['b', 'e', 'h']
  beatsAt(index: number): string[] {
    let ret = [];
    for (const bank of this.banks) {
      ret.push(bank[index]);
    }

    return ret;
  }

  removeBank(index: number) {
    if (this.banks.length > 1) {
      this.banks.splice(index, 1);
    }
  }

  addBank() {
    this.banks.push(".".repeat(this.mapLen));
  }
}

export class HuesSong {
  title: string;
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
    if (this.build && this.build.banks.length != this.loop.banks.length) {
      throw "Song bank lengths are mismatched!";
    }
    this.loop.checkConsistency();
    this.build?.checkConsistency();
  }

  generateXML(root: xmlbuilder.XMLNode) {
    let xml = root.ele("song", { name: this.loop.basename });
    xml.ele("title", this.title);
    if (this.source) {
      xml.ele("source", this.source);
    }
    xml.ele("rhythm", this.loop.banks[0]);
    for (let bank = 1; bank < this.loop.banks.length; bank++) {
      // rhythm2, rhythm3 etc
      xml.ele("rhythm" + (bank + 1), this.loop.banks[bank]);
    }

    if (this.build?.sound) {
      xml.ele("buildup", this.build.basename);
      xml.ele("buildupRhythm", this.build.banks[0]);
      for (let bank = 1; bank < this.build.banks.length; bank++) {
        // buildupRhythm2, buildupRhythm3 etc
        xml.ele("buildupRhythm" + (bank + 1), this.build.banks[bank]);
      }
      if (this.independentBuild) {
        xml.ele("independentBuild", "true");
      }
    }
  }

  protected async addSectionToZip<T>(
    zipWriter: zip.ZipWriter<T>,
    section?: HuesSongSection
  ) {
    if (!section?.sound) {
      return;
    }
    const u8 = new Uint8Array(section.sound);
    await zipWriter.add(
      "Songs/" + section.filename!,
      new zip.Uint8ArrayReader(u8)
    );
  }

  async addZipAssets<T>(zipWriter: zip.ZipWriter<T>) {
    await this.addSectionToZip(zipWriter, this.loop);
    await this.addSectionToZip(zipWriter, this.build);
  }
}

interface HuesImageElement extends HTMLImageElement {
  // we need to keep the blob around to save a modified respack
  blob: Blob;
}

export class HuesImage {
  public static readonly DEFAULT_ANIM_FRAME_TIME = 66; // 15fps
  name: string;
  fullname: string;
  align: "center" | "left" | "right";
  bitmaps: HuesImageElement[];
  frameDurations: number[];
  // straight from the XML
  rawFrameDurations?: string;
  source: string;
  enabled: boolean;
  beatsPerAnim: number;
  syncOffset: number;
  // for handling vertical/mobile screens better
  centerPixel?: number;

  constructor(
    name = "None",
    fullname = "None",
    bitmaps: HuesImageElement[] = []
  ) {
    this.name = name;
    this.fullname = fullname;
    this.align = "center";
    this.bitmaps = bitmaps;
    this.frameDurations = [];
    this.source = "";
    this.enabled = true;
    this.beatsPerAnim = 0;
    this.syncOffset = 0;

    if (bitmaps.length > 1) {
      // default/unset animation speed
      this.frameDurations = Array(bitmaps.length).fill(
        HuesImage.DEFAULT_ANIM_FRAME_TIME
      );
    }
  }

  get animated() {
    return this.bitmaps.length > 1;
  }

  generateXML(root: xmlbuilder.XMLNode) {
    let xml = root.ele("image", { name: this.name });

    if (this.fullname && this.fullname != this.name) {
      xml.ele("fullname", this.fullname);
    }
    if (this.source) {
      xml.ele("source", this.source);
    }
    if (this.align != "center") {
      xml.ele("align", this.align);
    }
    if (this.centerPixel !== undefined) {
      xml.ele("centerPixel", this.centerPixel);
    }
    // Note! frameDurations not used, if it can be changed, might want to
    // change this too...
    if (this.rawFrameDurations) {
      xml.ele("frameDuration", this.rawFrameDurations);
    }
    if (this.beatsPerAnim) {
      xml.ele("beatsPerAnim", this.beatsPerAnim);
    }
    if (this.syncOffset) {
      xml.ele("syncOffset", this.syncOffset);
    }
  }

  protected async addImagesToZip<T>(
    zipWriter: zip.ZipWriter<T>,
    folder: string
  ) {
    // pad with 0s any animation frames
    let pad = 1 + Math.floor(Math.log10(this.bitmaps.length));

    for (const [i, bitmap] of this.bitmaps.entries()) {
      let name = this.name;
      if (this.animated) {
        name += "_" + (i + 1).toString().padStart(pad, "0");
      }
      const ext = getExtensionFromMime(bitmap.blob.type);
      // shouldn't ever throw, because the respack images can only come
      // from known mimes
      if (!ext) {
        throw new Error(`Unknown image MIME type ${bitmap.blob.type}`);
      }

      await zipWriter.add(
        folder + "/" + name + "." + ext,
        new zip.BlobReader(bitmap.blob)
      );
    }
  }

  async addZipAssets<T>(zipWriter: zip.ZipWriter<T>) {
    if (this.animated) {
      await this.addImagesToZip(zipWriter, "Animations/" + this.name);
    } else {
      await this.addImagesToZip(zipWriter, "Images");
    }
  }
}

export type ProgressCallback = (percent: number, respack: Respack) => void;

const debugConsole = false;
function debug(...args: any[]) {
  if (debugConsole) {
    console.debug(...args);
  }
}

const audioMimes = new Set(["audio/mpeg", "audio/ogg", "audio/x-wav"]);
const imageMines = new Set([
  "image/png",
  "image/gif",
  "image/jpeg",
  "image/bmp",
]);

interface LoadedFile {
  filename: string;
  plainName: string; // without extension
  mime: string;
  data: Uint8Array;
}

interface LoadedImage {
  plainName: string;
  imgs: HuesImageElement[];
}

// used for lookups in the file lists
interface LoadedThing {
  plainName: string;
}

// just like getMineType from zip.js, but only the mimes we care for, as well as
// adding .opus support
const mimes: { [key: string]: string[] } = {
  "audio/mpeg": ["mpga", "mpega", "mp2", "mp3", "m4a", "mp2a", "m2a", "m3a"],
  "audio/ogg": ["ogg", "opus"],
  "audio/x-wav": ["wav"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/jpeg": ["jpg", "jpeg", "jpe"],
  "image/bmp": ["bmp"],
  "application/xml": ["xml"],
};

function flattenMimes(mimes: { [key: string]: string[] }) {
  let ret: { [key: string]: string } = {};
  for (const [key, vals] of Object.entries(mimes)) {
    for (const val of vals) {
      ret[val] = key;
    }
  }
  return ret;
}

const mimeTypes = flattenMimes(mimes);

function getMime(filename: string) {
  const defaultValue = "application/octet-stream";
  return (
    (filename && mimeTypes[filename.split(".").pop()?.toLowerCase()!]) ||
    defaultValue
  );
}

function getExtensionFromMime(mime: string): string | undefined {
  return mimes[mime]?.[0];
}

function basename(entry: zip.Entry) {
  const fullname = entry.filename;
  const parts = fullname.split("/");
  return parts.pop() || fullname;
}

// filename without extension
function plainName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

export class Respack {
  songs: HuesSong[];
  images: HuesImage[];

  name: string;
  author: string;
  description: string;
  link: string;

  size: number;
  downloaded: number;
  enabled: boolean;

  totalFiles: number;

  // For zip parsing progress events
  progressCallback: null | ProgressCallback;
  filesToLoad: number;
  filesLoaded: number;
  loadedFromURL: boolean;

  constructor() {
    this.songs = [];
    this.images = [];

    this.name = "<no name>";
    this.author = "<unknown>";
    this.description = "<no description>";
    this.link = "";

    this.size = -1;
    this.downloaded = -1;
    this.enabled = true;

    this.totalFiles = -1;

    this.progressCallback = null;
    this.filesToLoad = 0;
    this.filesLoaded = 0;
    this.loadedFromURL = false;
  }

  updateProgress(override?: number) {
    if (this.progressCallback) {
      let percent = this.filesLoaded / this.filesToLoad;
      if (this.loadedFromURL) {
        percent = percent / 2 + 0.5;
      }
      this.progressCallback(override === undefined ? percent : override, this);
    }
  }

  loadFromURL(url: string, progress: ProgressCallback) {
    debug(`Loading ${url}`);
    this.loadedFromURL = true;
    if (progress) {
      this.progressCallback = progress;
    }

    return this.getBlob(url).then((response) => {
      return this.loadFromBlob(response);
    });
  }

  getBlob(url: string, progress?: ProgressCallback): Promise<Blob> {
    if (progress !== undefined) {
      this.progressCallback = progress;
    }
    return new Promise<Blob>((resolve, reject) => {
      let req = new XMLHttpRequest();
      req.open("GET", url, true);
      req.responseType = "blob";
      req.onload = () => {
        if (req.status == 200) {
          resolve(req.response);
        } else {
          reject(Error(req.status + ": Could not fetch respack at " + url));
        }
      };
      req.onerror = function () {
        reject(Error(req.status + ": Could not fetch respack at " + url));
      };
      req.onprogress = (event) => {
        if (event.lengthComputable) {
          this.size = event.total;
          this.downloaded = event.loaded;
          let percent = event.loaded / event.total;
          if (this.progressCallback) {
            this.progressCallback(percent / 2, this); // because of processing too
          }
        }
      };
      req.send();
    }).catch((error) => {
      // Infinitely more user friendly than the error Same Origin gives
      if (error.code == 1012) {
        throw Error("Respack at URL " + url + " is restricted. Check CORS.");
      } else {
        throw error;
      }
    });
  }

  async loadFromBlob(blob: Blob, progress?: ProgressCallback) {
    if (progress !== undefined) {
      this.progressCallback = progress;
    }
    this.updateProgress(this.loadedFromURL ? 0.5 : 0);
    this.size = blob.size;

    const file = new zip.ZipReader(new zip.BlobReader(blob), {
      filenameEncoding: "utf8",
    });
    try {
      const entries = await file.getEntries();
      await this.parseZip(entries);

      return this;
    } catch (error: any) {
      console.error(error); // more details
      throw Error("Respack error:" + error);
    }
  }

  async parseZip(entries: zip.Entry[]) {
    // just metadata, not used for anything
    this.totalFiles = 0;
    // Progress events
    this.filesToLoad = 0;
    this.filesLoaded = 0;

    let songQueue = [];
    let imageQueue = [];
    let xmlQueue = [];

    // Don't parse in this loop - work out how many files for progress
    for (const file of entries) {
      if (!file.directory && file.filename) {
        this.totalFiles++;

        const mime = getMime(file.filename);
        if (audioMimes.has(mime)) {
          songQueue.push(file);
        } else if (imageMines.has(mime)) {
          imageQueue.push(file);
        } else if (mime == "application/xml") {
          xmlQueue.push(file);
        }
      }
    }

    this.filesToLoad = songQueue.length + imageQueue.length + xmlQueue.length;
    let songs = await this.loadQueue(songQueue);
    let images = await this.createImgElements(await this.loadQueue(imageQueue));
    let xmls = await this.loadQueue(xmlQueue);
    debug("songs", songs);
    debug("images", images);
    debug("xmls", xmls);

    for (const xml of xmls) {
      this.parseXML(xml, songs, images);
    }

    // any remaining songs had no XML definition / mistyped name or similar
    for (const song of songs) {
      console.warn(
        "We have a file for",
        song.filename,
        "but no information for it"
      );
    }
    // any remaining images are still valid, just have no extra info
    for (const image of images) {
      const img = new HuesImage(image.plainName, "", image.imgs);
      this.images.push(img);
      debug("  [I] " + img.name, ":", img.fullname, "added to images");
    }
    // sort images alphabetically
    this.images.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    console.log(
      "Loaded",
      this.name,
      "successfully with",
      this.songs.length,
      "songs and",
      this.images.length,
      "images."
    );
  }

  async loadQueue(files: zip.Entry[]): Promise<LoadedFile[]> {
    let res = [];
    for (const file of files) {
      const data = (await file.getData!(
        new zip.Uint8ArrayWriter()
      )) as Uint8Array;
      const mime = getMime(file.filename);
      const filename = basename(file);
      const plain = plainName(filename);
      res.push({ filename, plainName: plain, mime, data });

      this.filesLoaded++;
      this.updateProgress();
    }

    return res;
  }

  async createImgElements(files: LoadedFile[]): Promise<LoadedImage[]> {
    let imgs = [];
    for (const file of files) {
      const blob = new Blob([file.data.buffer], { type: file.mime });
      const img = new Image() as HuesImageElement;

      const prom = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
        img.blob = blob;
      });
      await prom;
      imgs.push({ filename: file.filename, plainName: file.plainName, img });
    }

    // group animations
    const res = []; // duplicate image names are acceptable, so this is a list
    const animations = new Map<string, HuesImageElement[]>();
    for (const img of imgs) {
      let plain = img.plainName;
      const match = plain.match(new RegExp("^(.*)_(\\d+)$"));
      if (match) {
        //animation

        plain = match[1];
        const frame = parseInt(match[2]);
        if (!animations.has(plain)) {
          animations.set(plain, []);
        }
        animations.get(plain)![frame] = img.img;
      } else {
        // normal
        res.push({ plainName: plain, imgs: [img.img] });
      }
    }

    // clean animations and add to result
    for (let [plain, imgs] of animations.entries()) {
      // an animation with frames 0, 3, 4, because of mislabelled files,
      // must be squashed into a single contiguous array
      imgs = imgs.filter(Boolean);

      // add back to the result
      res.push({ plainName: plain, imgs: imgs });
    }

    return res;
  }

  XMLtoDOM(file: LoadedFile) {
    let text = new TextDecoder().decode(file.data);

    let parser = new DOMParser();
    let dom = parser.parseFromString(text, "text/xml");

    // this is some real PHP-tier error reporting from this API
    if (dom.querySelector("parsererror")) {
      console.log(
        "Respack XML parse failed, attempting ampersand sanitisation"
      );
      // Some respacks don't properly escape ampersands, which trips
      // up the XML parser - so just escape them all and try again.
      // Respacks that correctly escape *other* elements (like &lt;
      // and &gt;) will also properly escape ampersands, so this
      // should be OK and not result in "&amp;&lt;" nonsense.
      text = text.replace(/&amp;/g, "&");
      text = text.replace(/&/g, "&amp;");
      dom = parser.parseFromString(text, "text/xml");

      if (dom.querySelector("parsererror")) {
        console.error("Respack XML parse failed again, ignoring");
        console.log(text);
        return null;
      }
    }

    return dom;
  }

  async parseXML(xml: LoadedFile, songs: LoadedFile[], images: LoadedImage[]) {
    let dom = this.XMLtoDOM(xml);
    if (!dom) {
      return;
    }

    debug("Parsing", xml.filename);

    for (const songNode of dom.getElementsByTagName("songs")) {
      this.parseSongFile(songNode, songs);
    }
    for (const imageNode of dom.getElementsByTagName("images")) {
      this.parseImageFile(imageNode, images);
    }
    for (const infoNode of dom.getElementsByTagName("info")) {
      this.parseInfoFile(infoNode);
    }
  }

  private findFile<T extends LoadedThing>(
    fileList: T[],
    plainName: string,
    errorMsgPrefix: string
  ): T | undefined {
    const res: T[] = [];
    for (const f of fileList) {
      if (plainName == f.plainName) {
        res.push(f);
      }
    }

    if (res.length == 0) {
      console.warn(`${errorMsgPrefix}: respack zip has no file with that name`);
    } else if (res.length > 1) {
      console.warn(
        `${errorMsgPrefix}: respack zip has ${res.length} files with that name. Using the first one we saw`
      );
    }

    // all callers use the value, so drop it from the list
    const val = res[0];
    if (val !== undefined) {
      fileList.splice(fileList.indexOf(val), 1);
    }

    return val;
  }

  loadExtraCharts(
    el: Element,
    section: HuesSongSection,
    tagPrefix: string,
    expected?: number
  ) {
    for (let i = 2; true; i++) {
      let extraChart = el.getTag(tagPrefix + i);
      if (extraChart === null) {
        break;
      }

      if (extraChart.length < section.mapLen) {
        console.warn(
          tagPrefix +
            i +
            " is shorter than primary " +
            tagPrefix +
            ", padding with '.'"
        );
        extraChart += ".".repeat(section.mapLen - extraChart.length);
      } else if (extraChart.length > section.mapLen) {
        console.warn(
          tagPrefix +
            i +
            " is longer than primary " +
            tagPrefix +
            ", truncating"
        );
        extraChart = extraChart.slice(0, section.mapLen);
      }

      section.banks.push(extraChart);
    }

    if (expected && section.banks.length != expected) {
      console.warn(
        "Should have seen",
        expected,
        tagPrefix,
        "sections, but found",
        section.banks.length
      );
      if (section.banks.length < expected) {
        console.warn("Adding empty banks to fit");
        for (let i = section.banks.length; i < expected; i++) {
          section.banks.push(".".repeat(section.mapLen));
        }
      } else {
        console.warn("Deleting excess banks");
        section.banks = section.banks.slice(0, expected);
      }
    }
  }

  parseInfoFile(info: Element) {
    debug(" - Parsing infoFile");

    // self reference strings to avoid changing strings twice in future
    this.name = info.getTag("name", this.name);
    this.author = info.getTag("author", this.author);
    this.description = info.getTag("description", this.description);
    this.link = info.getTag("link", this.link);
  }

  parseSongFile(dom: Element, songs: LoadedFile[]) {
    debug(" - Parsing songFile");

    for (const el of dom.children) {
      const plainName = el.getAttribute("name");
      if (!plainName) {
        console.warn(
          "songs xml: <song> element has no 'name' attribute, skipping"
        );
        continue;
      }

      const file = this.findFile(
        songs,
        plainName,
        `songs xml: <song> element ${plainName}`
      );
      if (!file) {
        continue;
      }

      const song = new HuesSong("", file.filename);
      song.loop.sound = file.data.buffer;

      song.title = el.getTag("title", "");
      if (!song.title) {
        song.title = "<no name>";
        console.warn(song.loop.basename, "has no title!");
      }

      let chart = el.getTag("rhythm");
      if (chart === null) {
        chart = "..no..rhythm..";
        console.warn(song.loop.basename, "has no rhythm!!");
      }
      song.loop.banks = [chart];
      this.loadExtraCharts(el, song.loop, "rhythm");

      const buildName = el.getTag("buildup");
      if (buildName) {
        debug(
          "  Finding a buildup '" + buildName + "' for ",
          song.loop.basename
        );
        const build = this.findFile(
          songs,
          buildName,
          `songs xml: buildup ${buildName}`
        );
        if (build) {
          // create the build section
          song.build = new HuesSongSection(build.filename);
          song.build.sound = build.data.buffer;

          let buildChart = el.getTag("buildupRhythm");
          if (buildChart === null) {
            buildChart = ".";
            console.warn(
              song.loop.basename,
              "has no buildup, despite having a buildup sound!!"
            );
          }
          song.build.banks = [buildChart];
          this.loadExtraCharts(
            el,
            song.build,
            "buildupRhythm",
            song.loop.banks.length
          );
        }
      }

      song.independentBuild = !!el.getTag("independentBuild");
      song.source = el.getTag("source", "");
      song.charsPerBeat = parseFloat(el.getTag("charsPerBeat", "0"));

      song.recalcBeatStrings();
      song.checkConsistency();
      this.songs.push(song);
      debug(
        "  [I] " + song.loop.basename,
        ": '" + song.title + "' added to songs"
      );
    }
  }

  parseImageFile(dom: Element, images: LoadedImage[]) {
    debug(" - Parsing imagefile");

    for (const el of dom.children) {
      const plainName = el.getAttribute("name");
      if (!plainName) {
        console.warn(
          "images xml: <image> element has no 'name' attribute, skipping"
        );
        continue;
      }

      const file = this.findFile(
        images,
        plainName,
        `images xml: <image> element ${plainName}`
      );
      if (!file) {
        continue;
      }

      const image = new HuesImage(plainName, "", file.imgs);

      image.fullname = el.getTag("fullname", "");
      image.source = el.getTag("source", "");
      image.align = el.getTag("align", image.align)! as HuesImage["align"];
      image.beatsPerAnim = parseFloat(el.getTag("beatsPerAnim", "0"));
      image.syncOffset = parseFloat(el.getTag("syncOffset", "0"));
      const centerPixel = el.getTag("centerPixel");
      if (centerPixel !== null) {
        image.centerPixel = parseInt(centerPixel);
      }
      let frameDur = el.getTag("frameDuration");
      if (frameDur) {
        image.rawFrameDurations = frameDur;
        image.frameDurations = [];
        let strSplit = frameDur.split(",");
        for (let j = 0; j < strSplit.length; j++) {
          image.frameDurations.push(parseInt(strSplit[j]));
        }
        // repeat the last duration if there's not enough
        if (image.frameDurations.length == 0) {
          image.frameDurations.push(HuesImage.DEFAULT_ANIM_FRAME_TIME);
        }
        while (image.frameDurations.length < image.bitmaps.length) {
          image.frameDurations.push(
            image.frameDurations[image.frameDurations.length - 1]
          );
        }
        debug("Frame durations:", image.frameDurations);
      }
      this.images.push(image);
      debug("  [I] " + image.name, ":", image.fullname, "added to images");
    }
  }

  containsSong(name: string) {
    return this.getSong(name) !== null;
  }

  containsImage(name: string) {
    return this.getImage(name) !== null;
  }

  getSong(name: string | undefined | null): null | HuesSong {
    for (let song of this.songs) {
      if (name == song.loop.basename) {
        return song;
      }
    }
    return null;
  }

  getImage(name: string | null): null | HuesImage {
    for (let image of this.images) {
      if (name == image.name) {
        return image;
      }
    }
    return null;
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    let element = document.createElement("a");
    element.setAttribute("href", url);
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  }

  async saveZIP() {
    const zip = await this.generateZIP();
    this.downloadBlob(zip, this.name + ".zip");
  }

  protected async addXML<T>(
    name: string,
    zipWriter: zip.ZipWriter<T>,
    xml: xmlbuilder.XMLNode
  ) {
    await zipWriter.add(name, new zip.TextReader(xml.end({ pretty: true })));
  }

  async generateZIP() {
    const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));

    if (this.songs.length > 0) {
      const songXml = xmlbuilder.create("songs");
      for (const song of this.songs) {
        song.generateXML(songXml);
        await song.addZipAssets(zipWriter);
      }
      await this.addXML("songs.xml", zipWriter, songXml);
    }

    if (this.images.length > 0) {
      const imageXml = xmlbuilder.create("images");
      for (const image of this.images) {
        image.generateXML(imageXml);
        await image.addZipAssets(zipWriter);
      }
      await this.addXML("images.xml", zipWriter, imageXml);
    }

    const infoXml = xmlbuilder.create("info");
    infoXml.ele("name", this.name);
    infoXml.ele("author", this.author);
    infoXml.ele("description", this.description);
    infoXml.ele("link", this.link);
    await this.addXML("info.xml", zipWriter, infoXml);

    return await zipWriter.close();
  }
}

declare global {
  interface Element {
    getTag(tag: string): string | null;
    getTag(tag: string, def: string): string;
  }
}

// Save some chars
Element.prototype.getTag = function (tag: string, def?: string): any {
  let t = this.getElementsByTagName(tag)[0];
  return t ? t.textContent : def !== undefined ? def : null;
};

// used by thunk.html
(<any>window).Respack = Respack;
