// main, modern and hlwn must be kept in that order
import "../css/hues-main.css";
import "../css/huesUI-modern.css";
import "../css/huesUI-hlwn.css";
// the rest can be any order
import "../css/huesUI-retro.css";
import "../css/huesUI-weed.css";
import "../css/huesUI-xmas.css";
import type { HuesColour, HuesCore } from "./HuesCore.svelte";
import type { HuesImage, HuesSong } from "./ResourcePack";
import { HuesIcon } from "./HuesIcon";
import { mixColours, intToHex } from "./Utils";

// useful utility
function makeDiv(cls: string) {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}

/*
    Base UI Class for Hues display. Parent is an element
    to put all your own elements under, but make a div
    underneath so it can be entirely hidden.
*/
export class HuesUI {
  root!: HTMLDivElement;
  core?: HuesCore;

  imageName!: HTMLDivElement;
  imageLink!: HTMLAnchorElement;

  songName!: HTMLDivElement;
  songLink!: HTMLAnchorElement;

  hueName!: HTMLDivElement;

  imagePrev!: HTMLDivElement;
  imageNext!: HTMLDivElement;
  songPrev!: HTMLDivElement;
  songNext!: HTMLDivElement;

  beatCount!: HTMLDivElement;
  timer!: HTMLDivElement;
  xBlur!: HTMLDivElement;
  yBlur!: HTMLDivElement;

  settingsToggle!: HTMLDivElement;
  hideToggle!: HTMLDivElement;

  // Put this near the links to song/image lists/ Bottom right alignment
  listContainer!: HTMLDivElement;
  // Must be dynamic width, 64 pixels high. Will be filled with visualiser
  visualiserContainer!: HTMLDivElement;

  songList!: HTMLDivElement;
  imageList!: HTMLDivElement;

  resizeHandler!: () => void;

  // some UIs have a 3 stage hide, so not bool
  hidden!: number | boolean;

  lastInvert = 0;

  // To deregister on UI hide we need to keep track of these
  // Add using this.addCoreCallback
  // Actually only use core's callback types but cbf adding the checks
  callbacks!: { name: string; func: (...args: any) => void }[];

  constructor(parent: HTMLElement, name?: string) {
    if (!parent) {
      return;
    }
    this.root = document.createElement("div");
    this.root.className = name ? name : this.constructor.name;
    parent.appendChild(this.root);
    this.root.classList.add("hidden");

    this.callbacks = [];

    this.hidden = false;

    // Major info, image, song names
    let imageName = document.createElement("div");
    this.imageName = imageName;

    this.imageLink = document.createElement("a");
    this.imageLink.target = "_blank";
    this.imageName.appendChild(this.imageLink);

    let songName = document.createElement("div");
    this.songName = songName;

    this.songLink = document.createElement("a");
    this.songLink.target = "_blank";
    this.songName.appendChild(this.songLink);

    let hueName = document.createElement("div");
    this.hueName = hueName;

    // Prev/next controls
    let imagePrev = document.createElement("div");
    imagePrev.textContent = "<";
    imagePrev.onclick = () => {
      this.core?.previousImage();
    };
    this.imagePrev = imagePrev;
    let imageNext = document.createElement("div");
    imageNext.textContent = ">";
    imageNext.onclick = () => {
      this.core?.nextImage();
    };
    this.imageNext = imageNext;
    let songPrev = document.createElement("div");
    songPrev.textContent = "<";
    this.songPrev = songPrev;
    songPrev.onclick = () => {
      this.core?.previousSong();
    };
    let songNext = document.createElement("div");
    songNext.textContent = ">";
    songNext.onclick = () => {
      this.core?.nextSong();
    };
    this.songNext = songNext;

    let songList = document.createElement("div");
    songList.textContent = "SONGS";
    songList.onclick = () => {
      this.core?.toggleSongList();
    };
    this.songList = songList;
    let imageList = document.createElement("div");
    imageList.textContent = "IMAGES";
    imageList.onclick = () => {
      this.core?.toggleImageList();
    };
    this.imageList = imageList;

    // Beat timer, x and y blur, millis timer
    this.timer = document.createElement("div");
    this.timer.textContent = "T=$0x00000";

    this.beatCount = document.createElement("div");
    this.beatCount.textContent = "B=$0x0000";

    this.xBlur = document.createElement("div");
    this.xBlur.textContent = "X=$0x00";

    this.yBlur = document.createElement("div");
    this.yBlur.textContent = "Y=$0x00";

    // Config stuff
    this.settingsToggle = document.createElement("div");
    this.settingsToggle.innerHTML = HuesIcon.COG;
    this.settingsToggle.className = "hues-icon";
    this.settingsToggle.onclick = () => {
      this.core?.window.selectOrToggle("OPTIONS");
    };

    this.hideToggle = document.createElement("div");
    this.hideToggle.innerHTML = "▼";
    this.hideToggle.onclick = () => {
      this.toggleHide();
    };

    this.listContainer = document.createElement("div");
    this.visualiserContainer = document.createElement("div");

    this.addCoreCallback("newsong", this.newSong.bind(this));
    this.addCoreCallback("newimage", this.newImage.bind(this));
    this.addCoreCallback("newcolour", this.newColour.bind(this));
    this.addCoreCallback("blurupdate", this.blurUpdated.bind(this));
    this.addCoreCallback("time", this.updateTime.bind(this));
    this.addCoreCallback("frame", this.onFrame.bind(this));
    this.resizeHandler = this.resize.bind(this);
  }

  addCoreCallback(name: string, func: (...args: any) => void) {
    this.callbacks.push({ name: name, func: func });
  }

  connectCore(core: HuesCore) {
    this.core = core;
    this.root.classList.remove("hidden");
    if (core.resourceManager.hasUI) {
      this.listContainer.appendChild(core.resourceManager.listView);
    }
    this.visualiserContainer.appendChild(this.core.visualiser);

    this.callbacks.forEach(function (callback) {
      core.addEventListener(<any>callback.name, callback.func);
    });
    window.addEventListener("resize", this.resizeHandler);
    this.resizeHandler();
  }

  disconnect() {
    this.callbacks.forEach((callback) => {
      this.core!.removeEventListener(<any>callback.name, callback.func);
    });
    this.core = undefined;
    this.root.classList.add("hidden");
    while (this.listContainer.firstElementChild) {
      this.listContainer.removeChild(this.listContainer.firstElementChild);
    }
    while (this.visualiserContainer.firstElementChild) {
      this.visualiserContainer.removeChild(
        this.visualiserContainer.firstElementChild,
      );
    }
    window.removeEventListener("resize", this.resizeHandler);
  }

  setOpacity(opacity: number) {
    this.root.style.opacity = opacity.toString();
  }

  // ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
  show() {
    this.root.classList.remove("hidden");
    this.setOpacity(1.0);
  }

  // ONLY FOR CHANGING UI, NOT FOR "HIDE" FEATURE
  hide() {
    this.root.classList.add("hidden");
  }

  toggleHide() {
    this.hidden = !this.hidden;
    if (this.hidden) {
      this.root.classList.add("hues-ui--hidden");
    } else {
      this.root.classList.remove("hues-ui--hidden");
    }
  }

  resize() {}
  updateVolume(vol: number) {}

  newSong(song: HuesSong) {
    if (!song) {
      return;
    }

    this.songLink.textContent = song.title.toUpperCase();
    this.songLink.href = song.source;
  }

  newImage(image: HuesImage) {
    if (!image) {
      return;
    }

    let name = image.fullname ? image.fullname : image.name;

    this.imageLink.textContent = name.toUpperCase();
    this.imageLink.href = image.source ? image.source : "";
  }

  newColour(colour: HuesColour) {
    this.hueName.textContent = colour.n.toUpperCase();
  }

  blurUpdated(x: number, y: number) {
    x = Math.floor(x * 0xff);
    y = Math.floor(y * 0xff);
    this.xBlur.textContent = "X=" + this.intToHex(x, 2);
    this.yBlur.textContent = "Y=" + this.intToHex(y, 2);
  }

  updateTime(time: number) {
    time = Math.floor(time * 1000);
    this.timer.textContent = "T=" + this.intToHex(time, 5);
  }

  onFrame() {
    const newInvert = this.core?.renderer.invert;
    if (newInvert !== undefined && newInvert != this.lastInvert) {
      this.root.style.setProperty("--invert", newInvert.toString());
      this.lastInvert = newInvert;
    }
  }

  intToHex(num: number, pad: number) {
    let str = intToHex(Math.abs(num), pad).slice(1);
    let prefix = num < 0 ? "-" : "$";
    return prefix + "0x" + str;
  }
}

/*
 Individual UIs ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

export class RetroUI extends HuesUI {
  container!: HTMLDivElement;
  mode!: HTMLDivElement;
  colourIndex!: HTMLDivElement;
  version!: HTMLDivElement;
  beatBar!: HTMLDivElement;
  controls!: HTMLDivElement;
  imageModeManual!: HTMLDivElement;
  imageModeAuto!: HTMLDivElement;
  subControls!: HTMLDivElement;
  hideRestore!: HTMLDivElement;

  constructor(parent: HTMLElement, name?: string) {
    super(parent, name ? name : "RetroUI");

    let container = document.createElement("div");
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

    let imageMode = document.createElement("div");
    this.imageModeManual = document.createElement("div");
    this.imageModeManual.textContent = "NORMAL";
    this.imageModeManual.onclick = () => {
      this.core?.setIsFullAuto(false);
    };
    this.imageModeManual.className = "hues-r-manualmode hues-r-button";
    this.imageModeAuto = document.createElement("div");
    this.imageModeAuto.textContent = "FULL AUTO";
    this.imageModeAuto.onclick = () => {
      this.core?.setIsFullAuto(true);
    };
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

    let subControl = document.createElement("div");
    subControl.className = "hues-r-subcontrols";
    subControl.appendChild(this.settingsToggle);
    this.imageList.textContent = "C";
    subControl.appendChild(this.imageList);
    subControl.appendChild(this.hideToggle);
    this.subControls = subControl;

    this.root.appendChild(subControl);

    this.hideRestore = document.createElement("div");
    this.hideRestore.className = "hues-r-hiderestore";
    this.hideRestore.innerHTML = "▲";
    this.hideRestore.onclick = () => {
      this.toggleHide();
    };
    this.root.appendChild(this.hideRestore);

    this.listContainer.className = "hues-r-listcontainer";
    this.root.appendChild(this.listContainer);

    this.visualiserContainer.className = "hues-r-visualisercontainer";
    this.root.appendChild(this.visualiserContainer);

    this.addCoreCallback("beatstring", this.beat.bind(this));
    this.addCoreCallback("newmode", this.newMode.bind(this));
  }

  toggleHide() {
    this.hidden = !this.hidden;
    if (this.hidden) {
      this.subControls.classList.add("hues-ui--hidden");
      this.controls.classList.add("hues-ui--hidden");
      this.container.classList.add("hues-ui--hidden");
      this.hideRestore.classList.add("hues-ui--hidden");
    } else {
      this.subControls.classList.remove("hues-ui--hidden");
      this.controls.classList.remove("hues-ui--hidden");
      this.container.classList.remove("hues-ui--hidden");
      this.hideRestore.classList.remove("hues-ui--hidden");
    }
  }

  connectCore(core: HuesCore) {
    super.connectCore(core);

    this.version.textContent = "V=$" + core.versionHex;
  }

  newMode(isAuto: boolean) {
    this.mode.textContent = "M=" + (isAuto ? "FULL AUTO" : "NORMAL");
  }

  newImage(image: HuesImage) {
    if (!image) {
      return;
    }

    this.imageLink.textContent = "I=" + image.name.toUpperCase();
    this.imageLink.href = image.source;
  }

  newColour(colour: HuesColour) {
    super.newColour(colour);

    this.colourIndex.textContent =
      "C=" + this.intToHex(this.core!.colourIndex, 2);
  }

  beat(beats: string, index: number) {
    let rest = beats.slice(1);
    this.beatBar.textContent = ">>" + rest;
    this.beatCount.textContent = "B=" + this.intToHex(index, 4);
  }

  resize() {
    this.core!.visualiser.width = this.visualiserContainer.offsetWidth;
    this.core!.resizeVisualiser();
  }
}

export class MinimalUI extends RetroUI {
  constructor(parent: HTMLElement, name?: string) {
    super(parent, name ? name : "MinimalUI");

    this.root.removeChild(this.controls);
    this.root.removeChild(this.subControls);
    this.container.removeChild(this.beatBar);
    this.container.innerHTML = "";
    this.container.appendChild(this.beatBar);
  }
}

export class WeedUI extends RetroUI {
  xVariance: number;
  yVariance: number;
  beatLeft!: HTMLDivElement;
  beatRight!: HTMLDivElement;

  constructor(parent: HTMLElement, name?: string) {
    super(parent, name ? name : "WeedUI");

    this.xVariance = 10;
    this.yVariance = 20;

    this.container.removeChild(this.beatBar);

    this.controls.className = "hues-w-controls";
    this.subControls.className = "hues-w-subcontrols";

    let beatBar = document.createElement("div");
    beatBar.className = "hues-w-beatbar";
    this.root.appendChild(beatBar);
    this.beatBar = beatBar;

    let beatLeft = document.createElement("div");
    beatLeft.className = "hues-w-beatleft";
    beatBar.appendChild(beatLeft);
    this.beatLeft = beatLeft;

    let beatRight = document.createElement("div");
    beatRight.className = "hues-w-beatright";
    beatBar.appendChild(beatRight);
    this.beatRight = beatRight;

    this.imageModeManual.textContent = "ONE";
    this.imageModeAuto.textContent = "MANY";

    this.visualiserContainer.className += " hues-w-visualisercontainer";
  }

  toggleHide() {
    super.toggleHide();
    if (this.hidden) {
      this.beatBar.classList.add("hues-ui--hidden");
    } else {
      this.beatBar.classList.remove("hues-ui--hidden");
    }
  }

  beat(beats: string, index: number) {
    let rest = beats.slice(1);

    this.beatLeft.textContent = rest;
    this.beatRight.textContent = rest;

    this.beatCount.textContent = "B=" + this.intToHex(index, 4);

    if (["x", "o", "X", "O"].indexOf(beats[0]) != -1) {
      let beatCenter = document.createElement("div");
      beatCenter.className = "hues-w-beataccent";
      let rot = this.round10(15 - Math.random() * 30);
      let x = this.round10(
        -this.xVariance / 2 + Math.random() * this.xVariance,
      );
      let y = this.round10(
        30 - this.yVariance / 2 + Math.random() * this.yVariance,
      );
      let transform =
        "rotate(" + rot + "deg) translate(" + x + "px, " + y + "px)";
      beatCenter.style.transform = transform;
      beatCenter.textContent = beats[0].toUpperCase();
      this.root.appendChild(beatCenter);
      window.setTimeout(this.removeBeat.bind(this, beatCenter), 1500);
    }
  }

  round10(num: number) {
    return Math.round(num * 10) / 10;
  }

  removeBeat(element: HTMLElement) {
    this.root.removeChild(element);
  }
}

export class ModernUI extends HuesUI {
  textSize_normal: number;
  textSize_small: number;
  songLink_size: number;
  imageLink_size: number;

  currentBeat: string;

  controls!: HTMLDivElement;
  leftBox!: HTMLDivElement;
  rightBox!: HTMLDivElement;
  songBlock!: HTMLDivElement;
  imageBlock!: HTMLDivElement;
  songShuffle!: HTMLDivElement;
  imageMode!: HTMLDivElement;
  leftInfo!: HTMLDivElement;
  rightInfo!: HTMLDivElement;
  beatBar!: HTMLDivElement;
  beatLeft!: HTMLDivElement;
  beatRight!: HTMLDivElement;
  beatCenter!: HTMLDivElement;
  hideRestore!: HTMLDivElement;
  volBar!: HTMLDivElement;
  volLabel!: HTMLDivElement;
  infoToggle!: HTMLDivElement;
  volInput!: HTMLInputElement;

  constructor(parent: HTMLElement, name?: string) {
    super(parent, name ? name : "ModernUI");

    this.textSize_normal = 0;
    this.textSize_small = 0;
    this.songLink_size = 0;
    this.imageLink_size = 0;

    this.currentBeat = ".";

    this.hidden = 0;

    this.imageName.className = "hues-m-imagename";
    this.songName.className = "hues-m-songtitle";

    let controls = document.createElement("div");
    controls.className = "hues-m-controls";
    this.root.appendChild(controls);
    this.controls = controls;

    controls.appendChild(this.imageName);
    controls.appendChild(this.songName);

    let leftBox = document.createElement("div");
    leftBox.className = "hues-m-leftbox";
    controls.appendChild(leftBox);
    this.leftBox = leftBox;

    this.hueName.className = "hues-m-huename";
    leftBox.appendChild(this.hueName);

    let volCluster = document.createElement("div");
    volCluster.className = "hues-m-vol-cluster";
    leftBox.appendChild(volCluster);

    this.settingsToggle.className += " hues-m-cog";
    volCluster.appendChild(this.settingsToggle);

    this.hideToggle.className = "hues-m-hide";
    volCluster.appendChild(this.hideToggle);

    let volBar = document.createElement("div");
    volBar.className = "hues-m-vol-bar";
    this.volBar = volBar;
    volCluster.appendChild(volBar);

    let label = document.createElement("div");
    label.textContent = "VOL";
    label.className = "hues-m-vol-label";
    label.onclick = () => {
      this.core?.soundManager.toggleMute();
    };
    volBar.appendChild(label);
    this.volLabel = label;

    this.infoToggle = document.createElement("div");
    this.infoToggle.innerHTML = "?";
    this.infoToggle.className = "hues-m-question";
    this.infoToggle.onclick = () => {
      this.core?.window.selectOrToggle("INFO");
    };
    volCluster.appendChild(this.infoToggle);

    let input = document.createElement("input");
    input.className = "hues-m-range";
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = "0.1";
    volBar.appendChild(input);
    this.volInput = input;
    input.oninput = () => {
      this.core?.soundManager.setVolume(parseFloat(input.value));
    };

    let rightBox = document.createElement("div");
    rightBox.className = "hues-m-rightbox";
    controls.appendChild(rightBox);
    this.rightBox = rightBox;

    //Song/image controls
    let songs = document.createElement("div");
    songs.className = "hues-m-controlblock";
    this.songBlock = songs;
    this.songList.className = "hues-m-songbutton";

    let songControls = document.createElement("div");
    songControls.className = "hues-m-controlbuttons";
    this.songPrev.className = "hues-m-prevbutton";
    this.songNext.className = "hues-m-nextbutton";
    this.songShuffle = document.createElement("div");
    this.songShuffle.innerHTML = HuesIcon.SHUFFLE;
    this.songShuffle.className = "hues-m-actbutton hues-icon";
    this.songShuffle.onclick = () => {
      this.core?.randomSong();
    };
    songs.appendChild(this.songList);
    songControls.appendChild(this.songPrev);
    songControls.appendChild(this.songShuffle);
    songControls.appendChild(this.songNext);
    songs.appendChild(songControls);
    rightBox.appendChild(songs);

    let images = document.createElement("div");
    images.className = "hues-m-controlblock";
    this.imageList.className = "hues-m-songbutton";
    this.imageBlock = images;

    let imageControls = document.createElement("div");
    imageControls.className = "hues-m-controlbuttons";

    this.imageMode = document.createElement("div");
    this.imageMode.innerHTML = HuesIcon.PLAY;
    this.imageMode.className = "hues-m-actbutton hues-icon";
    this.imageMode.onclick = () => {
      this.core?.toggleFullAuto();
    };
    this.imagePrev.className = "hues-m-prevbutton";
    this.imageNext.className = "hues-m-nextbutton";
    images.appendChild(this.imageList);
    imageControls.appendChild(this.imagePrev);
    imageControls.appendChild(this.imageMode);
    imageControls.appendChild(this.imageNext);
    images.appendChild(imageControls);
    rightBox.appendChild(images);

    let leftInfo = document.createElement("div");
    leftInfo.className = "hues-m-leftinfo";
    let rightInfo = document.createElement("div");
    rightInfo.className = "hues-m-rightinfo";
    leftInfo.appendChild(this.xBlur);
    leftInfo.appendChild(this.yBlur);
    rightInfo.appendChild(this.timer);
    rightInfo.appendChild(this.beatCount);
    this.rightInfo = rightInfo;
    this.leftInfo = leftInfo;
    controls.appendChild(leftInfo);
    controls.appendChild(rightInfo);

    this.visualiserContainer.className = "hues-m-visualisercontainer";
    controls.appendChild(this.visualiserContainer);

    let beatBar = document.createElement("div");
    beatBar.className = "hues-m-beatbar";
    this.root.appendChild(beatBar);
    this.beatBar = beatBar;

    let beatLeft = document.createElement("div");
    beatLeft.className = "hues-m-beatleft";
    beatBar.appendChild(beatLeft);
    this.beatLeft = beatLeft;

    let beatRight = document.createElement("div");
    beatRight.className = "hues-m-beatright";
    beatBar.appendChild(beatRight);
    this.beatRight = beatRight;

    let beatCenter = document.createElement("div");
    beatCenter.className = "hues-m-beatcenter";
    this.root.appendChild(beatCenter);
    this.beatCenter = beatCenter;

    this.hideRestore = document.createElement("div");
    this.hideRestore.className = "hues-m-hiderestore";
    this.hideRestore.onclick = () => {
      this.toggleHide();
    };
    this.root.appendChild(this.hideRestore);

    this.listContainer.className = "hues-m-listcontainer";
    this.root.appendChild(this.listContainer);

    this.addCoreCallback("beatstring", this.beat.bind(this));
    this.addCoreCallback("newmode", this.newMode.bind(this));
  }

  toggleHide() {
    // classList is new-ish, but if you have web audio you'll have this
    this.beatBar.classList.remove("hues-ui--hidden");
    this.beatCenter.classList.remove("hues-ui--hidden");
    this.controls.classList.remove("hues-ui--hidden");
    this.hideRestore.classList.remove("hues-ui--hidden");
    switch (this.hidden) {
      case 1:
        this.beatBar.classList.add("hues-ui--hidden");
        this.beatCenter.classList.add("hues-ui--hidden");
      /* falls through */
      case 0:
        this.controls.classList.add("hues-ui--hidden");
        this.hideRestore.classList.add("hues-ui--hidden");
    }
    this.hidden = ((this.hidden as number) + 1) % 3;
  }

  updateVolume(vol: number) {
    this.volInput.value = vol.toString();
    if (vol === 0) {
      this.volLabel.textContent = "(VOL)";
    } else {
      this.volLabel.textContent = "VOL";
    }
  }

  newMode(isAuto: boolean) {
    if (isAuto) {
      this.imageMode.innerHTML = HuesIcon.PAUSE;
    } else {
      this.imageMode.innerHTML = HuesIcon.PLAY;
    }
  }

  beat(beats: string, index: number) {
    this.currentBeat = beats[0];
    let rest = beats.slice(1);

    this.beatLeft.textContent = rest;
    this.beatRight.textContent = rest;

    if (this.currentBeat != ".") {
      while (this.beatCenter.firstElementChild) {
        this.beatCenter.removeChild(this.beatCenter.firstElementChild);
      }
      let span = this.beatCenter.ownerDocument.createElement("span");
      span.textContent = this.currentBeat;
      this.beatCenter.appendChild(span);
    }
    this.beatCount.textContent = "B=" + this.intToHex(index, 4);
  }

  // get the width of a single character in the link box for a given classname
  textWidth(className: string) {
    // Could be song or image link, don't care
    let el = this.songLink;
    let oldContent = el.innerHTML;

    // offsetWidth is rounded, divide by 100
    let text = "";
    for (let i = 0; i < 100; i++) {
      text += "&nbsp;";
    }
    el.innerHTML = text;
    // We override this just after so don't bother to restore it
    el.className = className;
    let size = el.offsetWidth / 100;

    el.innerHTML = oldContent;

    return size;
  }

  resize() {
    this.textSize_normal = this.textWidth("");
    this.textSize_small = this.textWidth("small");
    this.songLink_size = this.songName.clientWidth;
    this.imageLink_size = this.imageName.clientWidth;

    this.resizeSong();
    this.resizeImage();
    this.core!.visualiser.width = this.controls.offsetWidth;
    this.core!.resizeVisualiser();
  }

  resizeElement(el: HTMLElement, parentSize: number) {
    let chars = el.textContent!.length;
    if (chars * this.textSize_normal < parentSize) {
      el.className = "";
    } else if (chars * this.textSize_small < parentSize) {
      el.className = "small";
    } else {
      el.className = "x-small";
    }
  }

  resizeSong() {
    this.resizeElement(this.songLink, this.songLink_size);
  }

  resizeImage() {
    this.resizeElement(this.imageLink, this.imageLink_size);
  }

  newSong(song: HuesSong) {
    super.newSong(song);

    if (!song) {
      return;
    }

    this.resizeSong();
  }

  newImage(image: HuesImage) {
    super.newImage(image);

    if (!image) {
      return;
    }

    this.resizeImage();
  }
}

interface XmasLight extends HTMLDivElement {
  on: HTMLDivElement;
  onInvert: HTMLDivElement;
  off: HTMLDivElement;
  offInvert: HTMLDivElement;
  bulb: HTMLDivElement;
  bulbInvert: HTMLDivElement;
}

export class XmasUI extends ModernUI {
  lights: XmasLight[];

  snowCanvas!: HTMLCanvasElement;
  snowContext!: CanvasRenderingContext2D;
  snowing!: boolean;
  maxSnow!: number;
  snowAngle!: number;
  lastSnow!: number;
  snowflakes!: { x: number; y: number; r: number; d: number }[];

  constructor(parent: HTMLElement, name?: string) {
    super(parent, name ? name : "XmasUI");
    this.initSnow();

    this.controls.className += " hues-x-controls";
    this.beatBar.className += " hues-x-beatbar";

    this.lights = [];

    let wires = makeDiv("hues-x-wires");

    let left = makeDiv("hues-x-wiresleft");
    for (const l of xleft) {
      let light = this.newLight(left);
      light.style.transform = "rotate(" + l.angle + "deg)";
      light.style.left = l.x + "px";
      light.style.top = l.y + "px";
      this.lights.push(light);
    }

    let right = makeDiv("hues-x-wiresright");
    for (const l of xright) {
      let light = this.newLight(right);
      light.style.transform = "rotate(" + -l.angle + "deg)";
      light.style.right = l.x + "px";
      light.style.top = l.y + "px";
      this.lights.push(light);
    }

    let bottomHelper = makeDiv("hues-x-wiresbottomhelper");
    let bottom = makeDiv("hues-x-wiresbottom");
    for (const l of xbottom) {
      let light = this.newLight(bottom);
      light.style.transform = "rotate(" + l.angle + "deg)";
      light.style.left = l.x + "px";
      light.style.bottom = l.y + "px";
      this.lights.push(light);
    }

    wires.appendChild(left);
    wires.appendChild(makeDiv("hues-x-wiresleft inverted"));
    wires.appendChild(right);
    wires.appendChild(makeDiv("hues-x-wiresright inverted"));
    bottomHelper.appendChild(bottom);
    bottomHelper.appendChild(makeDiv("hues-x-wiresbottom inverted"));
    wires.appendChild(bottomHelper);
    this.root.appendChild(wires);

    this.visualiserContainer.className = "hues-x-visualisercontainer";
    this.controls.removeChild(this.visualiserContainer);
    this.beatBar.appendChild(this.visualiserContainer);
  }

  connectCore(core: HuesCore) {
    super.connectCore(core);
    this.startSnow();
  }

  disconnect() {
    this.stopSnow();
    super.disconnect();
  }

  lightOn(light: XmasLight) {
    light.on.className = "hues-x-lighton";
    light.onInvert.className = "hues-x-lighton inverted";
    light.off.className = "hues-x-lightoff";
    light.offInvert.className = "hues-x-lightoff inverted";
  }

  lightOff(light: XmasLight) {
    light.on.className = "hues-x-lighton off";
    light.onInvert.className = "hues-x-lighton off inverted";
    light.off.className = "hues-x-lightoff off";
    light.offInvert.className = "hues-x-lightoff off inverted";
  }

  lightFadeOut(light: XmasLight) {
    light.on.className = "hues-x-lighton hues-x-fade off";
    light.onInvert.className = "hues-x-lighton hues-x-fade off inverted";
    light.off.className = "hues-x-lightoff hues-x-fade off";
    light.offInvert.className = "hues-x-lightoff hues-x-fade off inverted";
  }

  lightRecolour(light: XmasLight) {
    let hue = Math.floor(Math.random() * 7) * -56;
    const pos = hue + "px 0";
    light.on.style.backgroundPosition = pos;
    light.onInvert.style.backgroundPosition = pos;
    light.off.style.backgroundPosition = pos;
    light.offInvert.style.backgroundPosition = pos;
  }

  randomLight(light: XmasLight) {
    if (Math.random() >= 0.5) {
      this.lightOn(light);
    } else {
      this.lightOff(light);
    }
  }

  newLight(parent: HTMLElement): XmasLight {
    let light = document.createElement("div") as XmasLight;
    light.className = "hues-x-lightbox";
    let bulb = document.createElement("div");
    let bulbInvert = document.createElement("div");
    let on = document.createElement("div");
    let onInvert = document.createElement("div");
    let off = document.createElement("div");
    let offInvert = document.createElement("div");
    bulb.appendChild(on);
    bulb.appendChild(onInvert);
    bulb.appendChild(off);
    bulb.appendChild(offInvert);
    light.appendChild(bulb);
    light.appendChild(bulbInvert);
    light.appendChild(makeDiv("hues-x-light"));
    light.appendChild(makeDiv("hues-x-light inverted"));
    parent.appendChild(light);
    light.on = on;
    light.onInvert = onInvert;
    light.off = off;
    light.offInvert = offInvert;
    light.bulb = bulb;
    light.bulbInvert = bulbInvert;
    this.randomLight(light);
    this.lightRecolour(light);
    return light;
  }

  beat(beats: string, index: number) {
    super.beat(beats, index);
    if (this.currentBeat != ".") {
      for (const light of this.lights) {
        switch (this.currentBeat) {
          case ":":
            this.lightOn(light);
            this.lightRecolour(light);
            break;
          case "+":
            this.lightFadeOut(light);
            break;
          default:
            this.randomLight(light);
        }
      }
    }
  }

  initSnow() {
    this.snowCanvas = document.createElement("canvas");
    this.snowContext = this.snowCanvas.getContext("2d")!;
    this.snowCanvas.width = 1280;
    this.snowCanvas.height = 720;
    this.snowCanvas.style.display = "none";
    this.snowCanvas.className = "hues-canvas hues-x-snow";

    this.root.appendChild(this.snowCanvas);

    this.snowing = false;
    this.maxSnow = 30;
    this.snowAngle = 0;
    this.lastSnow = 0;
    this.snowflakes = [];

    this.addCoreCallback("frame", this.drawSnow.bind(this));
  }

  // From http://thecodeplayer.com/walkthrough/html5-canvas-snow-effect

  startSnow() {
    this.snowing = true;
    this.snowCanvas.style.display = "block";
    let height = this.snowCanvas.height;
    let width = this.snowCanvas.width;
    this.snowAngle = 0;
    this.snowflakes = [];
    for (let i = 0; i < this.maxSnow; i++) {
      this.snowflakes.push({
        x: Math.random() * width, //x-coordinate
        y: Math.random() * height, //y-coordinate
        r: Math.random() * 4 + 1, //radius
        d: Math.random() * 25, //density
      });
    }
    this.lastSnow = Date.now() / 1000;
  }

  stopSnow() {
    this.snowing = false;
    this.snowCanvas.style.display = "none";
  }

  drawSnow() {
    const snowColour = intToHex(
      mixColours(0xffffff, 0, this.core!.renderer.invert),
    );
    // 80% alpha
    this.snowContext.fillStyle = snowColour + "cc";

    let width = this.snowCanvas.width;
    let height = this.snowCanvas.height;
    let now = Date.now() / 1000;
    let delta = this.lastSnow - now;
    this.lastSnow = now;
    this.snowContext.clearRect(0, 0, width, height);

    this.snowContext.beginPath();
    for (let i = 0; i < this.maxSnow; i++) {
      let flake = this.snowflakes[i];
      this.snowContext.moveTo(flake.x, flake.y);
      this.snowContext.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2, true);
    }
    this.snowContext.fill();

    this.snowAngle += delta / 6;
    for (let i = 0; i < this.maxSnow; i++) {
      let flake = this.snowflakes[i];
      //Updating X and Y coordinates
      //We will add 1 to the cos function to prevent negative values which will lead flakes to move upwards
      //Every particle has its own density which can be used to make the downward movement different for each flake
      //Lets make it more random by adding in the radius
      flake.y += Math.cos(this.snowAngle + flake.d) + 1 + flake.r / 2;
      flake.x += Math.sin(this.snowAngle) * 2;

      //Sending flakes back from the top when it exits
      //Lets make it a bit more organic and let flakes enter from the left and right also.
      if (flake.x > width + 5 || flake.x < -5 || flake.y > height) {
        if (i % 3 > 0) {
          //66.67% of the flakes
          this.snowflakes[i] = {
            x: Math.random() * width,
            y: -10,
            r: flake.r,
            d: flake.d,
          };
        } else {
          //If the flake is exitting from the right
          if (Math.sin(this.snowAngle) > 0) {
            //Enter from the left
            this.snowflakes[i] = {
              x: -5,
              y: Math.random() * height,
              r: flake.r,
              d: flake.d,
            };
          } else {
            //Enter from the right
            this.snowflakes[i] = {
              x: width + 5,
              y: Math.random() * height,
              r: flake.r,
              d: flake.d,
            };
          }
        }
      }
    }
  }

  resize() {
    super.resize();

    let ratio = window.innerWidth / window.innerHeight;
    // cleared on resize
    let savedFill = this.snowContext.fillStyle;
    this.snowCanvas.width = Math.ceil(720 * ratio);
    this.snowContext.fillStyle = savedFill;
  }
}

export class HalloweenUI extends ModernUI {
  vignette!: HTMLDivElement;

  constructor(parent: HTMLElement, name?: string) {
    super(parent, name ? name : "HalloweenUI");

    this.controls.className += " hues-h-controls";
    this.beatBar.className += " hues-h-beatbar";
    this.leftBox.className += " hues-h-leftbox";
    this.rightBox.className += " hues-h-rightbox";
    this.volBar.className += " hues-h-vol-bar";

    this.beatLeft.className += " hues-h-text";
    this.beatRight.className += " hues-h-text";
    this.beatCenter.className += " hues-h-text";
    this.songShuffle.className += " hues-h-text";
    this.songNext.className += " hues-h-text";
    this.songPrev.className += " hues-h-text";
    this.songList.className += " hues-h-text";
    this.songName.className += " hues-h-text";
    this.imageMode.className += " hues-h-text";
    this.imageNext.className += " hues-h-text";
    this.imagePrev.className += " hues-h-text";
    this.imageList.className += " hues-h-text";
    this.imageName.className += " hues-h-text";
    this.hueName.className += " hues-h-text";

    this.settingsToggle.className += " hues-h-text";
    this.hideToggle.className += " hues-h-text";
    this.infoToggle.className += " hues-h-text";
    this.volLabel.className += " hues-h-text";

    this.timer.className = "hues-h-textfade";
    this.beatCount.className = "hues-h-textfade";
    this.xBlur.className = "hues-h-textfade";
    this.yBlur.className = "hues-h-textfade";

    this.leftBox.appendChild(makeDiv("hues-h-tombstone"));
    this.leftBox.appendChild(makeDiv("hues-h-tombstone inverted"));

    this.songBlock.insertBefore(
      makeDiv("hues-h-tombstone"),
      this.songBlock.firstChild,
    );
    this.songBlock.insertBefore(
      makeDiv("hues-h-tombstone inverted"),
      this.songBlock.firstChild,
    );

    this.imageBlock.insertBefore(
      makeDiv("hues-h-tombstone"),
      this.imageBlock.firstChild,
    );
    this.imageBlock.insertBefore(
      makeDiv("hues-h-tombstone inverted"),
      this.imageBlock.firstChild,
    );

    this.root.appendChild(
      makeDiv("hues-m-beatcenter hues-h-text hues-h-skull"),
    );
    this.root.appendChild(
      makeDiv("hues-m-beatcenter hues-h-text hues-h-skull inverted"),
    );

    this.root.appendChild(makeDiv("hues-h-topleft"));
    this.root.appendChild(makeDiv("hues-h-topleft inverted"));
    this.root.appendChild(makeDiv("hues-h-topright"));
    this.root.appendChild(makeDiv("hues-h-topright inverted"));
    this.root.appendChild(makeDiv("hues-h-bottomright"));
    this.root.appendChild(makeDiv("hues-h-bottomright inverted"));

    this.beatBar.appendChild(makeDiv("hues-h-left-hand"));
    this.beatBar.appendChild(makeDiv("hues-h-left-hand inverted"));
    this.beatBar.appendChild(makeDiv("hues-h-right-hand"));
    this.beatBar.appendChild(makeDiv("hues-h-right-hand inverted"));

    this.vignette = document.createElement("div");
    this.vignette.className = "hues-h-vignette";
    this.root.appendChild(this.vignette);
  }

  beat(beats: string, index: number) {
    super.beat(beats, index);

    if (this.currentBeat != ".") {
      let eyes = document.createElement("div");
      eyes.className = "hues-m-beatcenter hues-h-eyes";
      this.beatCenter.appendChild(eyes);
      eyes = document.createElement("div");
      eyes.className = "hues-m-beatcenter hues-h-eyes inverted";
      this.beatCenter.appendChild(eyes);
    }
  }

  connectCore(core: HuesCore) {
    super.connectCore(core);

    this.core!.preloader.classList.add("hues-h-text");
  }

  disconnect() {
    this.core!.preloader.classList.remove("hues-h-text");

    super.disconnect();
  }
}

type LightDef = {
  angle: number;
  x: number;
  y: number;
};

// Positions and angles for the Xmas lights
const xleft: LightDef[] = [
  { angle: 122.529582194, x: 19.4, y: -19.35 },
  { angle: 92.5309436511, x: 25.4, y: 38.7 },
  { angle: 107.530202659, x: 39.4, y: 107.75 },
  { angle: 77.5309700777, x: 20.75, y: 184.8 },
  { angle: 77.5309700777, x: 32.3, y: 249.8 },
  { angle: 107.530202659, x: 40.45, y: 327.9 },
  { angle: 88.3307935055, x: 35, y: 410.9 },
  { angle: 107.530202659, x: 54.35, y: 490.95 },
  { angle: 74.9981580491, x: 28.15, y: 573.8 },
  { angle: 89.9973772074, x: 23.45, y: 675.35 },
  { angle: 107.530202659, x: 21.65, y: 762.6 },
  { angle: 107.530202659, x: 15.8, y: 842.75 },
  { angle: 92.5309436511, x: 36.55, y: 905.7 },
  { angle: 88.3307935055, x: 31.1, y: 988.7 },
  { angle: 107.530202659, x: 50.45, y: 1068.75 },
  { angle: 74.9981580491, x: 45.75, y: 1158.5 },
  { angle: 88.3307935055, x: 35.85, y: 1238.55 },
];
const xright: LightDef[] = [
  { angle: 120.001009518, x: 33.3, y: -29.75 },
  { angle: 90.0026227926, x: 35.35, y: 53.65 },
  { angle: 102.469029922, x: 41.5, y: 136.5 },
  { angle: 91.6692064945, x: 22.15, y: 216.55 },
  { angle: 72.4697973408, x: 34.4, y: 278.25 },
  { angle: 102.469029922, x: 45.75, y: 361.85 },
  { angle: 87.4699314665, x: 26.65, y: 426.35 },
  { angle: 72.4697973408, x: 41.6, y: 502.15 },
  { angle: 102.469029922, x: 27.5, y: 566 },
  { angle: 72.4697973408, x: 7.65, y: 638.45 },
  { angle: 102.469029922, x: 11, y: 721.25 },
  { angle: 76.1887724128, x: 7.65, y: 792.7 },
  { angle: 87.4690563489, x: 36.15, y: 850.35 },
  { angle: 102.46813454, x: 16.6, y: 924.3 },
  { angle: 72.4697973408, x: 15.3, y: 990.8 },
  { angle: 76.1887724128, x: 11.95, y: 1062.25 },
  { angle: 87.4690563489, x: 40.45, y: 1119.9 },
  { angle: 102.46813454, x: 20.9, y: 1193.85 },
];
const xbottom: LightDef[] = [
  { angle: 32.5804579323, x: 110.35, y: -12.1 },
  { angle: 3.28979777069, x: 168.05, y: -5.55 },
  { angle: 17.6989154099, x: 238.35, y: 7.7 },
  { angle: -12.6587029361, x: 314.8, y: -10.4 },
  { angle: -12.6587029361, x: 379.4, y: 1.05 },
  { angle: 17.6989154099, x: 457.75, y: 9.4 },
  { angle: 2.59102780115, x: 540.6, y: 3.75 },
  { angle: 17.6989154099, x: 620.35, y: 22.7 },
  { angle: -15.134241831, x: 703, y: -2.9 },
  { angle: 2.30443717424, x: 804.75, y: -7.85 },
  { angle: 17.6989154099, x: 892.45, y: -9.55 },
  { angle: 17.6989154099, x: 971.65, y: -15.5 },
  { angle: 3.28979777069, x: 1035.2, y: 4.35 },
  { angle: 2.59102780115, x: 1118, y: 0.2 },
  { angle: 17.6989154099, x: 1198.05, y: 18.95 },
  { angle: -18.378894807, x: 1288.2, y: 14.2 },
  { angle: -4.561224264, x: 1367.9, y: 4.6 },
  { angle: 32.5804579323, x: 1452.6, y: -1.7 },
  { angle: 3.28979777069, x: 1511.45, y: 4.45 },
  { angle: 17.6989154099, x: 1580.6, y: 17.6 },
  { angle: -12.6587029361, x: 1656.6, y: -0.95 },
  { angle: -12.6587029361, x: 1722.1, y: 11.1 },
  { angle: 17.6989154099, x: 1800.5, y: 18.8 },
  { angle: 2.59102780115, x: 1883.1, y: 13 },
  { angle: 17.6989154099, x: 1963, y: 32.6 },
  { angle: -15.134241831, x: 2045.8, y: 7 },
  { angle: 2.30443717424, x: 2147.55, y: 1.55 },
  { angle: 17.6989154099, x: 2234.1, y: 0.4 },
  { angle: 17.6989154099, x: 2315, y: -5.6 },
  { angle: 3.28979777069, x: 2377.8, y: 14.5 },
  { angle: 2.59102780115, x: 2460.65, y: 9.75 },
  { angle: 17.6989154099, x: 2540.2, y: 28.5 },
  { angle: -18.378894807, x: 2627.55, y: 24.9 },
  { angle: -4.561224264, x: 2710.4, y: 14.4 },
];
