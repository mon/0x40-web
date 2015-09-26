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
    blurQuality: "medium",
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
        options : ["low", "medium", "high"]
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
        options : ["retro", "v4.20", "modern", "xmas"]
    },
    colourSet : {
        name : "Colour Set",
        options : ["normal", "pastel", "v4.20"]
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
    this.root = document.getElementById("huesSettings");
    this.window = document.getElementById("settingsWindow");
    this.hide(); // TODO hide
    
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
    
    this.initUI();
}

HuesSettings.prototype.connectCore = function(core) {
    this.core = core;
    core.settingsUpdated();
};

HuesSettings.prototype.show = function() {
    this.window.style.display = "block";
}

HuesSettings.prototype.hide = function() {
    this.window.style.display = "none";
}

HuesSettings.prototype.toggle = function() {
    if(this.window.style.display == "none") {
        this.window.style.display = "block";
    } else {
        this.window.style.display = "none";
    }
}

HuesSettings.prototype.showRespacks = function() {
    this.show();
    document.getElementById("tab1").checked = true;
}

HuesSettings.prototype.showOptions = function() {
    this.show();
    document.getElementById("tab2").checked = true;
}

HuesSettings.prototype.showInfo = function() {
    this.show();
    document.getElementById("tab3").checked = true;
}

HuesSettings.prototype.initUI = function() {
    var doc = this.root.ownerDocument;
    
    var that = this;
    document.getElementById("closeButton").onclick = function() {that.hide();};
    
    // To order things nicely
    for(cat in this.settingsCategories) {
        var catContainer = doc.createElement("div");
        catContainer.textContent = cat;
        catContainer.className = "settings-category";
        var cats = this.settingsCategories[cat];
        for(var i = 0; i < cats.length; i++) {
            var setName = cats[i];
            var setContainer = doc.createElement("div");
            var setting = this.settingsOptions[setName];
            setContainer.textContent = setting.name;
            setContainer.className = "settings-individual";
            var buttonContainer = doc.createElement("div");
            buttonContainer.className = "settings-buttons";
            for(var j = 0; j < setting.options.length; j++) {
                var option = setting.options[j];
                var checkbox = doc.createElement("input");
                checkbox.className = "settings-checkbox";
                checkbox.type = "radio";
                checkbox.name = setName;
                checkbox.value = option;
                checkbox.id = setName + "-" + option;
                if(localStorage[setName] == option) {
                    checkbox.checked = true;
                }
                var that = this;
                checkbox.onclick = function() {
                    that.set(this.name, this.value);
                }
                buttonContainer.appendChild(checkbox);
                // So we can style this nicely
                var label = doc.createElement("label");
                label.className = "settings-label";
                label.htmlFor = checkbox.id;
                label.textContent = option.toUpperCase();
                buttonContainer.appendChild(label);
            }
            setContainer.appendChild(buttonContainer);
            catContainer.appendChild(setContainer);
        }
        this.root.appendChild(catContainer);
    }
}

// Set a named index to its named value, returns false if name doesn't exist
HuesSettings.prototype.set = function(setting, value) {
    value = value.toLowerCase();
    var opt = this.settingsOptions[setting];
    if(!opt || opt.options.indexOf(value) == -1) {
        console.log(value, "is not a valid value for", setting);
        return false;
    }
    // for updating the UI selection
    try {
        document.getElementById(setting + "-" + value).checked = true;
    } catch(e) {}
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