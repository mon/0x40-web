/* Copyright (c) 2015 William Toohey <will@mon.im>
 * Portions Copyright (c) 2015 Calvin Walton <calvin.walton@kepstin.ca>
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

import '../css/hues-settings.css';

import SettingsUI from './HuesSettings.svelte';

 (function(window, document) {
"use strict";

/* If you're modifying settings for your hues, DON'T EDIT THIS
   - Go to the HTML and edit the `defaults` object instead!
 */
const defaultSettings = {
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
    blackoutUI: "off",
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
    blackoutUI : {
        name : "Blackout affects UI",
        options : ["off", "on"]
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
};

class HuesSettings {
    constructor(defaults) {
        this.eventListeners = {
            /* callback updated()
             *
             * Called when settings are updated
             */
            updated : []
        };

        let settingsVersion = "1";
        if(localStorage.settingsVersion != settingsVersion) {
            localStorage.clear();
            localStorage.settingsVersion = settingsVersion;
        }

        this.ephemerals = {};

        for(let attr in defaultSettings) {
            if(!defaultSettings.hasOwnProperty(attr)) {
                continue;
            }
            Object.defineProperty(this, attr, {
                set: this.makeSetter(attr), get: this.makeGetter(attr)
            });

            if(defaults[attr] !== undefined) {
                if(defaults.overwriteLocal) {
                    this[attr] = defaults[attr];
                } else {
                    this.ephemerals[attr] = defaults[attr];
                }
            }
        }

        if (this.parseQueryString) {
            let querySettings = this.getQuerySettings();

            for(let attr in defaultSettings) {
                // query string overrides, finally
                if(querySettings[attr] !== undefined && attr != 'respacks') {
                    this.ephemerals[attr] = querySettings[attr];
                }
            }

            this.respacks = this.respacks.concat(querySettings.respacks);
        }
    }

    getQuerySettings() {
        let results = {};
        results.respacks = [];
        let query = window.location.search.substring(1);
        let vars = query.split("&");
        for (let i=0;i<vars.length;i++) {
            let pair = vars[i].split("=");
            let val = decodeURIComponent(pair[1]);
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
                results[pair[0]] = val;
            }
        }
        return results;
    }

    initUI(huesWin) {
        let uiTab = huesWin.addTab("OPTIONS");
        this.ui = new SettingsUI({
            target: uiTab,
            props: {
                settings: this,
                schema: settingsOptions,
            },
        });

        this.ui.$on('update', event => {
            this.callEventListeners("updated");
        });
    }

    makeGetter(setting) {
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
    makeSetter(setting) {
        return value => {
            if(this.isEphemeral(setting)) {
                this.ephemerals[setting] = value;
            } else {
                let opt = settingsOptions[setting];
                if(!opt || opt.options.indexOf(value) == -1) {
                    console.log(value, "is not a valid value for", setting);
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

    isEphemeral(setting) {
        return settingsOptions[setting] === undefined;
    }

    callEventListeners(ev) {
        let args = Array.prototype.slice.call(arguments, 1);
        this.eventListeners[ev].forEach(function(callback) {
            callback.apply(null, args);
        });
    }

    addEventListener(ev, callback) {
        ev = ev.toLowerCase();
        if (typeof(this.eventListeners[ev]) !== "undefined") {
            this.eventListeners[ev].push(callback);
        } else {
            throw Error("Unknown event: " + ev);
        }
    }

    removeEventListener(ev, callback) {
        ev = ev.toLowerCase();
        if (typeof(this.eventListeners[ev]) !== "undefined") {
            this.eventListeners[ev] = this.eventListeners[ev].filter(function(a) {
                return (a !== callback);
            });
        } else {
            throw Error("Unknown event: " + ev);
        }
    }
}

window.HuesSettings = HuesSettings;

})(window, document);
