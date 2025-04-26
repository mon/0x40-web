import { mount, type ComponentProps } from "svelte";
import "../css/hues-settings.css";
import EventListener from "./EventListener";

import SettingsUI from "./HuesSettingsUI.svelte";
import type HuesWindow from "./HuesWindow";

/* If you're modifying settings for your hues, DON'T EDIT THIS
   - Go to the HTML and edit the `defaults` object instead!
 */
const defaultSettings: SettingsData = {
  // List of respacks to load
  respacks: [],
  // If true, the query string (?foo=bar&baz=boz) will be parsed for settings
  parseQueryString: true,
  // ONLY USED FOR QUERY STRINGS this will be prepended to any respacks
  // passed in as a ?packs=query
  respackPath: "respacks/",
  // Debugging var, for loading zips or not
  load: true,
  // Debug, play first song automatically?
  autoplay: true,
  // If true, defaults passed in initialiser override locally saved
  overwriteLocal: false,
  // If set, will attempt to play the named song first
  firstSong: null,
  // If set, will attempt to set the named image first
  firstImage: null,
  // set to false to never change images
  fullAuto: true,
  // The remote respack listing JSON endpoint
  // NOTE: Any packs referenced need CORS enabled or loads fail
  packsURL: "https://cdn.0x40hu.es/getRespacks.php",
  // If set, will disable the remote resources menu. For custom pages.
  disableRemoteResources: false,
  // You will rarely want to change this. Enables/disables the Hues Window.
  enableWindow: true,
  // Whether to show the Hues Window on page load
  showWindow: false,
  // What tab will be displayed first in the Hues Window
  firstWindow: "INFO",
  // Preloader customisation
  preloadPrefix: "0x",
  preloadBase: 16,
  preloadMax: 0x40,
  preloadTitle: "",
  // Info customisation
  huesName: "0x40 Hues of JS, v%VERSION%",
  huesDesc: `0x40 Hues has some music and a few images, and the
        music plays and the images change.
        This is such a fine idea, like wowzers.
        Som- many like it!`,
  // If unset, uses <body>, otherwise sets which element to turn hues-y
  root: null,
  // If set, keyboard shortcuts are ignored
  disableKeyboard: false,

  // UI accessible config
  smartAlign: "on",
  blurAmount: "medium",
  blurDecay: "fast",
  blurQuality: "medium",
  currentUI: "modern",
  colourSet: "normal",
  blendMode: "hard-light",
  bgColour: "transparent",
  blackoutUI: "off",
  invertStyle: "everything",
  playBuildups: "on",
  visualiser: "off",
  shuffleImages: "on",
  autoSong: "off",
  autoSongDelay: 5, // loops or minutes depending on autoSong value
  autoSongShuffle: "on",
  autoSongFadeout: "on",
  trippyMode: "off",
  volume: 0.7,
  skipPreloader: "off",
};

// for the UI accessible config only
export const uiSettingsOptions = {
  smartAlign: {
    name: "Smart Align images",
    options: ["off", "on"],
  },
  blurAmount: {
    name: "Blur amount",
    options: ["low", "medium", "high"],
  },
  blurDecay: {
    name: "Blur decay",
    options: ["slow", "medium", "fast", "faster!"],
  },
  blurQuality: {
    name: "Blur quality",
    options: ["low", "medium", "high", "extreme"],
  },
  visualiser: {
    name: "Spectrum analyser",
    options: ["off", "on"],
  },
  currentUI: {
    name: "UI style",
    options: ["retro", "v4.20", "modern", "xmas", "hlwn", "mini"],
  },
  colourSet: {
    name: "Colour set",
    options: ["normal", "pastel", "v4.20"],
  },
  blendMode: {
    name: "Blend mode",
    options: ["hard-light", "screen", "multiply"],
  },
  bgColour: {
    name: "Render backdrop",
    options: ["white", "black", "transparent"],
  },
  blackoutUI: {
    name: "Blackout affects UI",
    options: ["off", "on"],
  },
  invertStyle: {
    name: "Invert affects",
    options: ["everything", "image"],
  },
  playBuildups: {
    name: "Play buildups",
    options: ["off", "once", "on"],
  },
  autoSong: {
    name: "AutoSong",
    options: ["off", "loop", "time"],
  },
  autoSongShuffle: {
    name: "AutoSong shuffle",
    options: ["off", "on"],
  },
  autoSongFadeout: {
    name: "AutoSong fade out",
    options: ["off", "on"],
  },
  trippyMode: {
    name: "Trippy Mode",
    options: ["off", "on"],
  },
  shuffleImages: {
    name: "Shuffle images",
    options: ["off", "on"],
  },
  skipPreloader: {
    name: "Skip preloader warning",
    options: ["off", "on"],
  },
} as const; // this magic little thing lets us use "options" as a tuple type!

export type SettingsData = {
  respacks: string[];
  parseQueryString: boolean;
  respackPath: string;
  load: boolean;
  autoplay: boolean;
  overwriteLocal: boolean;
  firstSong: string | null;
  firstImage: string | null;
  fullAuto: boolean;
  packsURL: string;
  disableRemoteResources: boolean;
  enableWindow: boolean;
  showWindow: boolean;
  firstWindow: string;
  preloadPrefix: string;
  preloadBase: number;
  preloadMax: number;
  preloadTitle: string;
  huesName: string;
  huesDesc: string;
  root: HTMLElement | string | null;
  disableKeyboard: boolean;

  // UI accessible config
  smartAlign: (typeof uiSettingsOptions.smartAlign.options)[number];
  blurAmount: (typeof uiSettingsOptions.blurAmount.options)[number];
  blurDecay: (typeof uiSettingsOptions.blurDecay.options)[number];
  blurQuality: (typeof uiSettingsOptions.blurQuality.options)[number];
  currentUI: (typeof uiSettingsOptions.currentUI.options)[number];
  colourSet: (typeof uiSettingsOptions.colourSet.options)[number];
  blendMode: (typeof uiSettingsOptions.blendMode.options)[number];
  bgColour: (typeof uiSettingsOptions.bgColour.options)[number];
  blackoutUI: (typeof uiSettingsOptions.blackoutUI.options)[number];
  invertStyle: (typeof uiSettingsOptions.invertStyle.options)[number];
  playBuildups: (typeof uiSettingsOptions.playBuildups.options)[number];
  visualiser: (typeof uiSettingsOptions.visualiser.options)[number];
  shuffleImages: (typeof uiSettingsOptions.shuffleImages.options)[number];
  autoSong: (typeof uiSettingsOptions.autoSong.options)[number];
  autoSongShuffle: (typeof uiSettingsOptions.autoSongShuffle.options)[number];
  autoSongFadeout: (typeof uiSettingsOptions.autoSongFadeout.options)[number];
  trippyMode: (typeof uiSettingsOptions.trippyMode.options)[number];
  skipPreloader: (typeof uiSettingsOptions.skipPreloader.options)[number];
  autoSongDelay: number;
  volume: number;
};

type SettingsEvents = {
  // Called when settings are updated
  updated: () => void;
};
export class HuesSettings
  extends EventListener<SettingsEvents>
  implements SettingsData
{
  respacks = $state() as SettingsData["respacks"];
  parseQueryString = $state() as SettingsData["parseQueryString"];
  respackPath = $state() as SettingsData["respackPath"];
  load = $state() as SettingsData["load"];
  autoplay = $state() as SettingsData["autoplay"];
  overwriteLocal = $state() as SettingsData["overwriteLocal"];
  firstSong = $state() as SettingsData["firstSong"];
  firstImage = $state() as SettingsData["firstImage"];
  fullAuto = $state() as SettingsData["fullAuto"];
  packsURL = $state() as SettingsData["packsURL"];
  disableRemoteResources = $state() as SettingsData["disableRemoteResources"];
  enableWindow = $state() as SettingsData["enableWindow"];
  showWindow = $state() as SettingsData["showWindow"];
  firstWindow = $state() as SettingsData["firstWindow"];
  preloadPrefix = $state() as SettingsData["preloadPrefix"];
  preloadBase = $state() as SettingsData["preloadBase"];
  preloadMax = $state() as SettingsData["preloadMax"];
  preloadTitle = $state() as SettingsData["preloadTitle"];
  huesName = $state() as SettingsData["huesName"];
  huesDesc = $state() as SettingsData["huesDesc"];
  root = $state() as SettingsData["root"];
  disableKeyboard = $state() as SettingsData["disableKeyboard"];

  // UI accessible
  smartAlign = $state() as SettingsData["smartAlign"];
  blurAmount = $state() as SettingsData["blurAmount"];
  blurDecay = $state() as SettingsData["blurDecay"];
  blurQuality = $state() as SettingsData["blurQuality"];
  currentUI = $state() as SettingsData["currentUI"];
  colourSet = $state() as SettingsData["colourSet"];
  blendMode = $state() as SettingsData["blendMode"];
  bgColour = $state() as SettingsData["bgColour"];
  blackoutUI = $state() as SettingsData["blackoutUI"];
  invertStyle = $state() as SettingsData["invertStyle"];
  playBuildups = $state() as SettingsData["playBuildups"];
  visualiser = $state() as SettingsData["visualiser"];
  shuffleImages = $state() as SettingsData["shuffleImages"];
  autoSong = $state() as SettingsData["autoSong"];
  autoSongDelay = $state() as SettingsData["autoSongDelay"];
  autoSongShuffle = $state() as SettingsData["autoSongShuffle"];
  autoSongFadeout = $state() as SettingsData["autoSongFadeout"];
  trippyMode = $state() as SettingsData["trippyMode"];
  volume = $state() as SettingsData["volume"];
  skipPreloader = $state() as SettingsData["skipPreloader"];

  uiProps: ComponentProps<typeof SettingsUI> = $state({
    settings: this,
    schema: uiSettingsOptions,
  });

  constructor(defaults: Partial<SettingsData>) {
    super();

    let settingsVersion = "1";
    if (localStorage.settingsVersion != settingsVersion) {
      localStorage.clear();
      localStorage.settingsVersion = settingsVersion;
    }

    const settingsKeys = Object.keys(defaultSettings) as (keyof SettingsData)[];

    for (const attr of settingsKeys) {
      // this is too tricky for typescript and/or my brain, so just be
      // lazy with the <any>
      if (defaults.overwriteLocal) {
        (<any>this)[attr] =
          localStorage[attr] ?? defaults[attr] ?? defaultSettings[attr];
      } else {
        (<any>this)[attr] =
          defaults[attr] ?? localStorage[attr] ?? defaultSettings[attr];
      }
    }

    if (this.parseQueryString) {
      let querySettings = this.getQuerySettings();

      for (const attr of settingsKeys) {
        // query string overrides, finally
        if (querySettings[attr] !== undefined && attr != "respacks") {
          (<any>this)[attr] = querySettings[attr];
        }
      }

      this.respacks = this.respacks.concat(querySettings.respacks);
    }

    // attach our event listeners
    for (const attr of settingsKeys) {
      $effect.root(() => {
        let first = true;
        $effect(() => {
          this[attr]; // ensure deps are caught
          if (first) {
            first = false;
            return;
          }

          console.debug(`Setting updated ${attr} -> ${this[attr]}`);

          if (!this.isEphemeral(attr)) localStorage[attr] = this[attr];

          this.callEventListeners("updated");
        });
      });
    }
  }

  getQuerySettings() {
    let results: Partial<SettingsData> & { respacks: string[] } = {
      respacks: [],
    };
    let query = window.location.search.substring(1);
    let vars = query.split("&");
    for (let i = 0; i < vars.length; i++) {
      let pair = vars[i].split("=");
      let val: string | boolean = decodeURIComponent(pair[1]);
      if (pair[0] == "packs" || pair[0] == "respacks") {
        let packs = val.split(",");
        for (let j = 0; j < packs.length; j++) {
          results.respacks.push(this.respackPath + packs[j]);
        }
      } else if (pair[0] == "song") {
        // alias for firstSong
        results.firstSong = val;
      } else {
        // since we can set ephemeral variables this way
        if (val === "true" || val === "false") val = val == "true";
        (<any>results)[pair[0]] = val;
      }
    }
    return results;
  }

  initUI(huesWin: HuesWindow) {
    let uiTab = huesWin.addTab("OPTIONS");
    mount(SettingsUI, {
      target: uiTab,
      props: this.uiProps,
    });
  }

  isEphemeral(setting: keyof SettingsData) {
    return !uiSettingsOptions.hasOwnProperty(setting);
  }
}
