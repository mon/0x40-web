waifus = {}

waifus.defaults = {
    respacks: ["respacks/default.zip"],
    preloadBuild: null,
    preloadLoop: null,
    preloadOutro: null,
    customColourSet: null,
    blurQuality: 2, // low/med/high/extreme 0-3
    
    // UI accessible config
    // Autosong stuff is a todo
    smartAlign: true,
    blendMode: "hard-light", // hard-light, TODO: plain, alpha
    blurAmount: 1,           // 0,1,2,3 = off,low,med,high
    blurDecay: 2,            // 0,1,2,3 = slow,med,fast,faster!
    colourSet: "normal",     // normal, pastel, 420, custom
    // scaleImages, nah
    blackoutUI: false,
    // channel selection, nah
    playBuildups: "on"       // off, once, on
}

waifus.init = function() {
    console.log("Initialising 0x40");
    // merge defaults and user set stuff
    waifus.config = waifus.config || {};
    for(var attr in waifus.defaults) {
        if(!waifus.config[attr])
            waifus.config[attr] = waifus.defaults[attr];
    }
    
    waifus.updateBlurQuality();
    waifus.updateBlurAmount();
    waifus.updateBlurDecay();
    waifuCanvas.blendMode = waifus.config.blendMode;
    waifuCanvas.init();
    
    waifus.initPreloader();
    if(waifus.config.preloadBuild || waifus.config.preloadLoop || waifus.config.preloadOutro)
        waifus.initPreloadSong();
    
    for(var i in waifus.config.respacks) {
        waifus.loadRespack(i);
    }
    console.log("Initialisation complete");
}


waifus.initPreloadSong = function() {
    
}

waifus.initPreloader = function() {
    waifus.preload = [];
    waifus.leftToLoad = waifus.config.respacks.length;
    for(var i in waifus.config.respacks) {
        waifus.preload[i] = 0;
    }
}

waifus.updatePreloader = function() {
    var total = 0;
    for(var i in waifus.config.respacks) {
        total += waifus.preload[i];
    }
    total /= waifus.config.respacks.length;
    total = Math.floor(total * 0x40);
    document.getElementById("preloader").innerHTML = '0x' + pad(total.toString(16), 2);
}

waifus.loadRespack = function(i) {
    var respack = waifus.config.respacks[i];
    console.log("Loading " + respack);
    var req = new XMLHttpRequest();
    req.open('GET', respack, true);
    req.responseType = 'arraybuffer';
    req.onload = function() {
        console.log(respack + " downloaded");
        waifus.onRespackLoad(req.response);
    };
    req.onprogress = function(evt) {
      if (evt.lengthComputable) {
        waifus.preload[i] = evt.loaded / evt.total;
        waifus.updatePreloader();
      }
    }
    req.send();
}

waifus.onRespackLoad = function(buff) {
    processRespack(buff);
    waifus.leftToLoad--;
    if(!waifus.leftToLoad) {
        console.log("All zips downloaded");
        document.getElementById("preloader").style.color = "#0F0";
    }
}

waifus.updateBlurQuality = function() {
    var iterations = [5, 15, 31, 65];
    waifuCanvas.setBlurIterations(iterations[waifus.config.blurQuality]);
}

waifus.updateBlurAmount = function() {
    var amount = [0, 15, 30, 60];
    waifuCanvas.setBlurAmount(amount[waifus.config.blurAmount]);
}

waifus.updateBlurDecay = function() {
    var decay = [10, 15, 25, 45];
    waifuCanvas.setBlurDecay(decay[waifus.config.blurDecay]);
}