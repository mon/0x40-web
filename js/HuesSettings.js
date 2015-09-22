HuesSettings.prototype.defaultSettings = {
    // Debugging var, for loading zips or not
    load : true,
    // Debug, play first song automatically?
    autoplay : true,
    // If true, defaults passed in initialiser override locally saved
    overwriteLocal : false,
    
    // UI accessible config
    // Autosong stuff is a todo, becuase why even implement that
    smartAlign: "on",
    blurAmount: "medium",
    blurDecay: "fast",
    blurQuality: "high",
    currentUI: "modern",
    colourSet: "normal",
    blackoutUI: "off",
    playBuildups: "on",
    volume : 0.7
}

// To dynamically build the UI like the cool guy I am
HuesSettings.prototype.settingsCategories = {
    "Image Settings" : [
        "smartAlign",
        "blurAmount",
        "blurDecay",
        "blurQuality"
    ],
    "UI Settings" : [
        "currentUI",
        "colourSet",
        "blackoutUI"
    ],
    "Audio Settings" : [
        "playBuildups"
    ]
}

HuesSettings.prototype.settingsOptions = {
    smartAlign : {
        name : "Smart Align Images",
        options : ["on", "off"]
    },
    blurAmount : {
        name : "Blur Amount",
        options : ["low", "med", "high"]
    },
    blurDecay : {
        name : "Blur Decay",
        options : ["slow", "medium", "fast", "faster!"]
    },
    blurQuality : {
        name : "Blur Quality",
        options : ["low", "medium", "high", "extreme"]
    },
    currentUI : {
        name : "User Interface",
        options : ["retro", "weed", "modern", "xmas"]
    },
    colourSet : {
        name : "Colour Set",
        options : ["normal", "pastel", "420"]
    },
    blackoutUI : {
        name : "Blackout affects UI",
        options : ["on", "off"]
    },
    playBuildups : {
        name : "Play buildups",
        options : ["off", "once", "on"]
    }
    
}

function HuesSettings(defaults) {
    this.core = null;
    
    for(var attr in this.defaultSettings) {
        if(attr == "respacks") {
            continue;
        }
        if(defaults[attr] == undefined) {
            defaults[attr] = this.defaultSettings[attr];
        } else if(defaults.overwriteLocal) {
            localStorage[attr] = defaults[attr];
        }
        // populate defaults, ignoring current
        if(localStorage[attr] == undefined) {
            localStorage[attr] = defaults[attr];
        }
    }
    
    this.defaults = defaults;
}

HuesSettings.prototype.connectCore = function(core) {
    this.core = core;
    core.settingsUpdated();
};

// Set a named index to its named value, returns false if name doesn't exist
HuesSettings.prototype.set = function(setting, value) {
    value = value.toLowerCase();
    var opt = this.settingsOptions[setting];
    if(!opt || opt.options.indexOf(value) == -1) {
        return false;
    }
    localStorage[setting] = value;
    core.settingsUpdated();
    return true;
}

// Note: This is not defaults as per defaultSettings, but those merged with
// the defaults given in the initialiser
HuesSettings.prototype.setDefaults = function() {
    for(var attr in this.defaults) {
        if(attr == "respacks") {
            continue;
        }
        localStorage[attr] = this.defaults[attr];
    }
}