import '../css/hues-settings.css';
import EventListener from './EventListener';

import SettingsUI from './HuesSettings.svelte';
import type HuesWindow from './HuesWindow';

/* If you're modifying settings for your hues, DON'T EDIT THIS
   - Go to the HTML and edit the `defaults` object instead!
 */
const defaultSettings: SettingsData = {
    // Location relative to root - where do the audio/zip workers live
    // This is required because Web Workers need an absolute path
    workersPath : "lib/workers/",
    // List of respacks to load
    respacks : [],
    // If true, the query string (?foo=bar&baz=boz) will be parsed for settings
    parseQueryString : true,
    // ONLY USED FOR QUERY STRINGS this will be prepended to any respacks
    // passed in as a ?packs=query
    respackPath : "respacks/",
    // Debugging var, for loading zips or not
    load : true,
    // Debug, play first song automatically?
    autoplay : true,
    // If true, defaults passed in initialiser override locally saved
    overwriteLocal : false,
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
    huesDesc:
        `0x40 Hues has some music and a few images, and the
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
    bgColour: "white",
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
    skipPreloader: "off"
};

// for the UI accessible config only
const settingsOptions = {
    smartAlign : {
        name : "Smart Align images",
        options : ["off", "on"]
    },
    blurAmount : {
        name : "Blur amount",
        options : ["low", "medium", "high"]
    },
    blurDecay : {
        name : "Blur decay",
        options : ["slow", "medium", "fast", "faster!"]
    },
    blurQuality : {
        name : "Blur quality",
        options : ["low", "medium", "high", "extreme"]
    },
    visualiser : {
        name : "Spectrum analyser",
        options : ["off", "on"]
    },
    currentUI : {
        name : "UI style",
        options : ["retro", "v4.20", "modern", "xmas", "hlwn", "mini"]
    },
    colourSet : {
        name : "Colour set",
        options : ["normal", "pastel", "v4.20"]
    },
    blendMode : {
        name : "Blend mode",
        options : ["hard-light", "screen", "multiply"]
    },
    bgColour : {
        name : "Render backdrop",
        options : ["white", "black", "transparent"]
    },
    blackoutUI : {
        name : "Blackout affects UI",
        options : ["off", "on"]
    },
    invertStyle : {
        name : "Invert affects",
        options : ["everything", "image"]
    },
    playBuildups : {
        name : "Play buildups",
        options : ["off", "once", "on"]
    },
    autoSong : {
        name : "AutoSong",
        options : ["off", "loop", "time"]
    },
    autoSongShuffle : {
        name : "AutoSong shuffle",
        options : ["off", "on"]
    },
    autoSongFadeout : {
        name : "AutoSong fade out",
        options : ["off", "on"]
    },
    trippyMode : {
        name : "Trippy Mode",
        options : ["off", "on"]
    },
    shuffleImages : {
        name : "Shuffle images",
        options : ["off", "on"]
    },
    skipPreloader : {
        name : "Skip preloader warning",
        options : ["off", "on"]
    }
} as const; // this magic little thing lets us use "options" as a tuple type!

export type SettingsData = {
    workersPath: string;
    respacks: string[];
    parseQueryString: boolean;
    respackPath: string;
    load: boolean;
    autoplay: boolean;
    overwriteLocal : boolean;
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
    smartAlign:      typeof settingsOptions.smartAlign.options[number];
    blurAmount:      typeof settingsOptions.blurAmount.options[number];
    blurDecay:       typeof settingsOptions.blurDecay.options[number];
    blurQuality:     typeof settingsOptions.blurQuality.options[number];
    currentUI:       typeof settingsOptions.currentUI.options[number];
    colourSet:       typeof settingsOptions.colourSet.options[number];
    blendMode:       typeof settingsOptions.blendMode.options[number];
    bgColour:        typeof settingsOptions.bgColour.options[number];
    blackoutUI:      typeof settingsOptions.blackoutUI.options[number];
    invertStyle:     typeof settingsOptions.invertStyle.options[number];
    playBuildups:    typeof settingsOptions.playBuildups.options[number];
    visualiser:      typeof settingsOptions.visualiser.options[number];
    shuffleImages:   typeof settingsOptions.shuffleImages.options[number];
    autoSong:        typeof settingsOptions.autoSong.options[number];
    autoSongShuffle: typeof settingsOptions.autoSongShuffle.options[number];
    autoSongFadeout: typeof settingsOptions.autoSongFadeout.options[number];
    trippyMode:      typeof settingsOptions.trippyMode.options[number];
    skipPreloader:   typeof settingsOptions.skipPreloader.options[number];
    autoSongDelay: number;
    volume: number;
}

type SettingsEvents = {
    // Called when settings are updated
    updated: () => void;
}

export interface HuesSettings extends SettingsData {}
export class HuesSettings extends EventListener<SettingsEvents> {
    ephemerals: Partial<SettingsData>;
    ui?: SettingsUI;

    constructor(defaults: Partial<SettingsData>) {
        super();

        let settingsVersion = "1";
        if(localStorage.settingsVersion != settingsVersion) {
            localStorage.clear();
            localStorage.settingsVersion = settingsVersion;
        }

        this.ephemerals = {};

        for(let _attr in defaultSettings) {
            let attr = _attr as keyof SettingsData;
            Object.defineProperty(this, attr, {
                set: this.makeSetter(attr as keyof SettingsData), get: this.makeGetter(attr as keyof SettingsData)
            });

            // this is too tricky for typescript and/or my brain, so just be
            // lazy with the <any>
            if(defaults[attr] !== undefined) {
                if(defaults.overwriteLocal) {
                    (<any>this)[attr] = defaults[attr];
                } else {
                    (<any>this.ephemerals)[attr] = defaults[attr];
                }
            }
        }

        if (this.parseQueryString) {
            let querySettings = this.getQuerySettings();

            for(let _attr in defaultSettings) {
                let attr = _attr as keyof SettingsData;
                // query string overrides, finally
                if(querySettings[attr] !== undefined && attr != 'respacks') {
                    (<any>this.ephemerals)[attr] = querySettings[attr];
                }
            }

            this.respacks = this.respacks.concat(querySettings.respacks!);
        }
    }

    getQuerySettings() {
        let results: Partial<SettingsData> = {};
        results.respacks = [];
        let query = window.location.search.substring(1);
        let vars = query.split("&");
        for (let i=0;i<vars.length;i++) {
            let pair = vars[i].split("=");
            let val: string | boolean = decodeURIComponent(pair[1]);
            if(pair[0] == "packs" || pair[0] == "respacks"){
                let packs = val.split(",");
                for(let j = 0; j < packs.length; j++) {
                    results.respacks.push(this.respackPath + packs[j]);
                }
            } else if(pair[0] == "song") { // alias for firstSong
                results.firstSong = val;
            } else {
                // since we can set ephemeral variables this way
                if(val === "true" || val === "false")
                    val = val == "true";
                (<any>results)[pair[0]] = val;
            }
        }
        return results;
    }

    initUI(huesWin: HuesWindow) {
        let uiTab = huesWin.addTab("OPTIONS");
        this.ui = new SettingsUI({
            target: uiTab,
            props: {
                settings: this,
                schema: settingsOptions,
            },
        });

        this.ui.$on('update', () => {
            this.callEventListeners("updated");
        });
    }

    makeGetter(setting: keyof SettingsData) {
        return () => {
            if(defaultSettings.hasOwnProperty(setting)) {
                if(this.ephemerals[setting] !== undefined)
                    return this.ephemerals[setting];
                else if(localStorage[setting] !== undefined)
                    return localStorage[setting];
                else
                    return defaultSettings[setting];
            } else {
                console.log("WARNING: Attempted to fetch invalid setting:", setting);
                return null;
            }
        };
    }

    // Set a named index to its named value, returns false if name doesn't exist
    makeSetter<S extends keyof SettingsData>(setting: S) {
        return (value: SettingsData[S]) => {
            if(this.isEphemeral(setting)) {
                this.ephemerals[setting] = value;
            } else {
                let opt = (<any>settingsOptions)[setting];
                if(!opt || opt.options.indexOf(value) == -1) {
                    console.error(value, "is not a valid value for", setting);
                    return false;
                }
                localStorage[setting] = value;
                this.ephemerals[setting] = undefined;
            }

            if(this.ui) {
                this.ui.$set({settings: this});
            }
            return true;
        };
    }

    isEphemeral(setting: keyof SettingsData) {
        return !settingsOptions.hasOwnProperty(setting);
    }
}
