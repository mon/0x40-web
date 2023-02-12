import xmlbuilder from "xmlbuilder";
import * as zip from "@zip.js/zip.js";

import { HuesSong, Respack, type HuesSongSection } from "./ResourcePack";
import EditorMain from "./HuesEditor/Main.svelte";
import type { HuesCore } from "./HuesCore";
import type HuesWindow from "./HuesWindow";
import type EditorBoxSvelte from "./HuesEditor/EditorBox.svelte";

export interface EditorUndoRedo {
  builds?: string[];
  loops?: string[];
  independentBuild: boolean;
  caret?: number;
  editor?: EditorBoxSvelte;
}

type SectionName = "build" | "loop";

export class HuesEditor {
  core: HuesCore;
  song?: HuesSong;
  editor!: EditorMain;

  // for storing respacks created with "new"
  respack?: Respack;

  // to avoid recursion
  midUpdate!: boolean;

  constructor(core: HuesCore, huesWin: HuesWindow) {
    this.core = core;
    if (!core.settings.enableWindow) {
      return;
    }

    this.midUpdate = false;

    let container = huesWin.addTab("EDITOR");
    this.editor = new EditorMain({
      target: container,
      props: {
        huesRoot: this.core.root,
        soundManager: this.core.soundManager,
        // if the first window is the editor, the user doesn't want the extra click
        // but eh, maybe the performance impact really isn't that bad
        totallyDisabled: false,
        //totallyDisabled: this.core.settings.firstWindow != 'EDITOR',
      },
    });

    core.addEventListener("newsong", (song) => {
      if (this.midUpdate) {
        return;
      }

      this.song = song;
      this.editor.$set({
        independentBuild: song?.independentBuild,
        title: song?.title,
        source: song?.source,
        loop: song?.loop,
        build: song?.build,
        undoQueue: song?.undoQueue,
        redoQueue: song?.redoQueue,
        hiddenBanks: song?.hiddenBanks,
        disabled: !song,
      });
    });

    core.soundManager.addEventListener("songloading", (promise, song) => {
      this.editor.$set({ songLoadPromise: promise });
    });

    core.addEventListener("beatstring", (beatString, beatIndex) => {
      this.editor.$set({ beatIndex: beatIndex });
    });

    // update any changed fields from the editor component
    this.editor.$on("update", (event) => {
      if (core.currentSong) {
        Object.assign(core.currentSong, event.detail);
        this.core.updateBeatLength();
        // We may have to go backwards in time
        this.core.recalcBeatIndex();

        this.midUpdate = true;
        this.core.callEventListeners("newsong", core.currentSong);
        this.midUpdate = false;
      }
    });

    this.editor.$on("loadbuildup", (event) =>
      this.onLoadAudio("build", event.detail)
    );
    this.editor.$on("loadrhythm", (event) =>
      this.onLoadAudio("loop", event.detail)
    );
    this.editor.$on("removebuildup", (event) => this.onRemoveAudio("build"));
    this.editor.$on("removerhythm", (event) => this.onRemoveAudio("loop"));
    this.editor.$on("addbank", (event) => this.addBank());
    this.editor.$on("removebank", (event) => this.removeBank(event.detail));
    this.editor.$on("songnew", (event) => this.newSong());
    this.editor.$on("savezip", (event) => this.saveZIP());
    this.editor.$on("savexml", (event) => this.saveXML());
    this.editor.$on("copyxml", (event) => this.copyXML());
  }

  other(section: SectionName): SectionName {
    return { build: "loop", loop: "build" }[section] as SectionName;
  }

  async onLoadAudio(section: SectionName, sectionData: HuesSongSection) {
    // If first load, this makes fresh, gets the core synced up
    this.newSong(this.song);

    // brand new section may be added (eg: new build, fresh loop)
    this.editor.$set({ [section]: sectionData });

    // Have we just added a build to a song with a rhythm, or vice versa?
    // If so, link their lengths
    let newlyLinked =
      !this.song![section]?.sound && !!this.song![this.other(section)]?.sound;

    // Do we have a loop to play?
    if (this.song!.loop.sound) {
      // Force refresh
      await this.core.soundManager.playSong(this.song!, true, true);
      if (newlyLinked) {
        this.setIndependentBuild(false);
      }
      this.editor.resyncEditors();
      this.core.updateBeatLength();
      // We may have to go backwards in time
      this.core.recalcBeatIndex();
    }
  }

  onRemoveAudio(section: SectionName) {
    // Is the loop playable?
    if (this.song!.loop.sound) {
      this.core.soundManager.playSong(this.song!, true, true);
    } else {
      this.core.soundManager.stop();
    }

    if (section == "build") {
      this.editor.$set({ build: undefined });
    }
  }

  addBank() {
    if (this.song) {
      this.song.addBank();
      // resync UI
      this.editor.$set({
        loop: this.song.loop,
        build: this.song.build,
        hiddenBanks: this.song.hiddenBanks,
      });
    }
  }

  removeBank(index: number) {
    if (this.song) {
      this.song.removeBank(index);
      // resync UI
      this.editor.$set({
        loop: this.song.loop,
        build: this.song.build,
        hiddenBanks: this.song.hiddenBanks,
      });
    }
  }

  newSong(song?: HuesSong) {
    if (!song) {
      song = new HuesSong("Title");
      // editor-created charts are a little more vibrant
      song.loop.banks = ["x...o...x...o..."];
      if (!this.respack) {
        this.respack = new Respack();
        this.respack.name = "Editor Respack";
        this.respack.author = "You!";
        this.respack.description =
          "An internal resourcepack for editing new songs";
        this.core.resourceManager.addPack(this.respack);
      }
      this.respack.songs.push(song);
      this.core.resourceManager.rebuildArrays();
      this.core.resourceManager.rebuildEnabled();
      this.core.setSongOject(song);
    }

    // Force independent build if only 1 source is present
    this.updateIndependentBuild();

    // Unlock beatmap lengths
    this.editor.$set({ locked: false });

    // You probably don't want to lose it
    window.onbeforeunload = () => "Unsaved beatmap - leave anyway?";
  }

  updateIndependentBuild() {
    // Force independent build if only 1 source is present

    // Effectively `buildup ^ loop` - does only 1 exist?
    let hasBuild = !!this.song?.build?.sound;
    let hasLoop = !!this.song?.loop.sound;
    if (hasBuild != hasLoop) {
      this.setIndependentBuild(true);
    }
  }

  setIndependentBuild(indep: boolean) {
    this.editor.$set({ independentBuild: indep });
  }

  generateXML(root?: xmlbuilder.XMLNode) {
    if (!this.song) {
      return null;
    }

    if (!root) {
      root = xmlbuilder.begin();
    }

    this.song.generateXML(root);

    return root.end({ pretty: true });
  }

  downloadURI(uri: string, filename: string) {
    // http://stackoverflow.com/a/18197341
    let element = document.createElement("a");
    element.setAttribute("href", uri);
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  async saveZIP() {
    let result = this.generateXML(xmlbuilder.create("songs"));
    if (!result) {
      return;
    }

    const zipWriter = new zip.ZipWriter(
      new zip.Data64URIWriter("application/zip")
    );
    await zipWriter.add("songs.xml", new zip.TextReader(result));
    await this.song!.addZipAssets(zipWriter);

    const dataURI = await zipWriter.close();

    this.downloadURI(
      dataURI,
      "0x40Hues - " + this.song!.loop.basename + ".zip"
    );

    window.onbeforeunload = null;
  }

  saveXML() {
    let result = this.generateXML(xmlbuilder.create("songs"));
    if (!result) {
      return;
    }

    this.downloadURI(
      "data:text/plain;charset=utf-8," + encodeURIComponent(result),
      "0x40Hues - " + this.song!.loop.basename + ".xml"
    );

    window.onbeforeunload = null;
  }

  // http://stackoverflow.com/a/30810322
  copyXML() {
    let text = this.generateXML();

    // Clicking when disabled
    if (!text) {
      return;
    }

    let textArea = document.createElement("textarea");
    textArea.className = "copybox";

    textArea.value = text;

    document.body.appendChild(textArea);

    textArea.select();

    let success;

    try {
      success = document.execCommand("copy");
    } catch (err) {
      success = false;
    }

    document.body.removeChild(textArea);
    if (success) {
      this.editor.alert("Beatmap XML copied to clipboard!");
    } else {
      this.editor.alert("Copy failed! Try saving instead");
    }
  }
}
