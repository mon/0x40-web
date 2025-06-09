import xmlbuilder from "xmlbuilder";

import { HuesSong, Respack, type HuesSongSection } from "./ResourcePack";
import EditorMain from "./HuesEditor/Main.svelte";
import type { HuesCore } from "./HuesCore";
import type HuesWindow from "./HuesWindow";
import type EditorBoxSvelte from "./HuesEditor/EditorBox.svelte";
import { mount, type ComponentProps } from "svelte";

const _zip = import("@zip.js/zip.js");

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
  editorProps = $state({}) as ComponentProps<EditorMain>;
  editor!: ReturnType<typeof EditorMain>;

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
    this.editorProps.huesRoot = this.core.root;
    this.editorProps.soundManager = this.core.soundManager;
    // if the first window is the editor, the user doesn't want the extra click
    // but eh, maybe the performance impact really isn't that bad
    this.editorProps.totallyDisabled = false;
    //this.editor.totallyDisabled = this.core.settings.firstWindow != 'EDITOR',
    this.editor = mount(EditorMain, {
      target: container,
      props: this.editorProps,
      events: {
        loadbuildup: (event) => this.onLoadAudio("build", event.detail),
        loadrhythm: (event) => this.onLoadAudio("loop", event.detail),
        removebuildup: (event) => this.onRemoveAudio("build"),
        removerhythm: (event) => this.onRemoveAudio("loop"),
        addbank: (event) => this.addBank(),
        removebank: (event) => this.removeBank(event.detail),
        songnew: (event) => this.newSong(),
        savezip: (event) => this.saveZIP(),
        savexml: (event) => this.saveXML(),
        copyxml: (event) => this.copyXML(),
        // update any changed fields from the editor component
        update: (event) => {
          if (core.currentSong) {
            Object.assign(core.currentSong, event.detail);
            this.core.updateBeatLength();
            // We may have to go backwards in time
            this.core.recalcBeatIndex();

            this.midUpdate = true;
            this.core.callEventListeners("newsong", core.currentSong);
            this.midUpdate = false;
          }
        },
      },
    });

    core.addEventListener("newsong", (song) => {
      if (this.midUpdate) {
        return;
      }

      this.song = song;
      this.editorProps.independentBuild = song?.independentBuild;
      this.editorProps.title = song?.title;
      this.editorProps.source = song?.source;
      this.editorProps.loop = song?.loop;
      this.editorProps.build = song?.build;
      this.editorProps.undoQueue = song?.undoQueue;
      this.editorProps.redoQueue = song?.redoQueue;
      this.editorProps.hiddenBanks = song?.hiddenBanks;
      this.editorProps.disabled = !song;
    });

    core.soundManager.addEventListener("songloading", (promise, song) => {
      this.editorProps.songLoadPromise = promise;
    });

    core.addEventListener("beatstring", (beatString, beatIndex) => {
      this.editorProps.beatIndex = beatIndex;
    });
  }

  other(section: SectionName): SectionName {
    return { build: "loop", loop: "build" }[section] as SectionName;
  }

  async onLoadAudio(section: SectionName, sectionData: HuesSongSection) {
    // If first load, this makes fresh, gets the core synced up
    this.newSong(this.song);

    // brand new section may be added (eg: new build, fresh loop)
    this.editorProps[section] = sectionData;

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
      this.editorProps.build = undefined;
    }
  }

  addBank() {
    if (this.song) {
      this.song.addBank();
      // resync UI, TODO: jank hackfix for svelte 5
      this.editorProps.loop = undefined;
      this.editorProps.loop = this.song.loop;
      this.editorProps.build = undefined;
      this.editorProps.build = this.song.build;
      this.editorProps.hiddenBanks = undefined;
      this.editorProps.hiddenBanks = this.song.hiddenBanks;
    }
  }

  removeBank(index: number) {
    if (this.song) {
      this.song.removeBank(index);
      // resync UI, TODO: jank hackfix for svelte 5
      this.editorProps.loop = undefined;
      this.editorProps.loop = this.song.loop;
      this.editorProps.build = undefined;
      this.editorProps.build = this.song.build;
      this.editorProps.hiddenBanks = undefined;
      this.editorProps.hiddenBanks = this.song.hiddenBanks;
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
    this.editorProps.locked = false;

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
    this.editorProps.independentBuild = indep;
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

    const zip = await _zip;

    const zipWriter = new zip.ZipWriter(
      new zip.Data64URIWriter("application/zip"),
    );
    await zipWriter.add("songs.xml", new zip.TextReader(result));
    await this.song!.addZipAssets(zipWriter);

    const dataURI = await zipWriter.close();

    this.downloadURI(
      dataURI,
      "0x40Hues - " + this.song!.loop.basename + ".zip",
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
      "0x40Hues - " + this.song!.loop.basename + ".xml",
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
