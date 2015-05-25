var canvas;
var needsRedraw = false;

var waifuImgs = new Array();
var waifuColour = "#FFF";

// constant
var blurIterations = 20; // quality
var blurMin = -blurIterations/2;
var blurMax = blurIterations/2;
var blurAlpha = 1/(blurIterations/2);
var blurDecay = 25;
var blurAmount = 15;
// dynamic
var blurStart = 0;
var blurDistance = 0;
var xBlur = false;
var yBlur = false;

var blackout = false;
var shortBlackout = false;

waifuCanvas = {};

waifuCanvas.init = function() {
    canvas = document.getElementById("waifu").getContext("2d");
    window.addEventListener('resize', waifuCanvas.resize);
    waifuCanvas.resize();
    canvas.drawImage(waifuImgs[0], 0, 0);
}

waifuCanvas.resize = function() {
    // height is constant 720px, we expand width to suit
    var ratio = window.innerWidth / window.innerHeight;
    canvas.canvas.width = 720 * ratio + 1;
    needsRedraw = true;
}

waifuCanvas.preload = function() {
    for(var waifu in waifus) {
        newImg = new Image();
        newImg.onload = onFileLoad;
        newImg.src = 'images/' + waifus[waifu].file;
        waifuImgs[waifu] = newImg;
    }
}

waifuCanvas.redraw = function() {
    var offset; // for centering/right/left align
    var width = canvas.canvas.width;
    var image = waifuImgs[nCurrentWaifu];
    // white BG for the hard light filter
    canvas.globalAlpha = 1;
    canvas.globalCompositeOperation = "source-over";
    if(blackout) {
        canvas.fillStyle = "#000";
        canvas.fillRect(0,0,width,720);
        needsRedraw = false;
        return;
    } else {
        canvas.fillStyle = "#FFF";
        canvas.fillRect(0,0,width,720);
    }
    
    switch(waifus[nCurrentWaifu].align) {
        case "left":
            offset = 0;
            break;
        case "right":
            offset = width - image.width;
            break;
        default:
            offset = width/2 - image.width/2;
            break;
    }
    if(xBlur || yBlur) {
        canvas.globalAlpha = blurAlpha;
        var delta = audio.context.currentTime - blurStart;
        blurDistance = blurAmount * Math.exp(-blurDecay * delta);
    }
    if(xBlur) {
        for(var i=blurMin; i<=blurMax; i++) {
            canvas.drawImage(image, Math.floor(blurDistance * i) + offset, 0);
        }
    } else if(yBlur) {
        for(var i=blurMin; i<=blurMax; i++) {
            canvas.drawImage(image, offset, Math.floor(blurDistance * i));
        }
    } else {
        canvas.globalAlpha = 1;
        canvas.drawImage(image, offset, 0);
    }
    canvas.globalAlpha = 0.7;
    canvas.fillStyle = waifuColour;
    canvas.globalCompositeOperation = "hard-light";
    canvas.fillRect(0,0,width,720);
    
    needsRedraw = false;
}

waifuCanvas.animationLoop = function() {
    if(blurStart && blurDistance < 0.3) {
        blurDistance = 0;
        blurStart = 0;
        xBlur = yBlur = false;
        waifuCanvas.redraw();
    } else if(blurStart) {
        waifuCanvas.redraw();
    } else if(needsRedraw){
        waifuCanvas.redraw();
    }
}

waifuCanvas.newWaifu = function() {
    GetRandomWaifu(); // increments the waifu counter
    needsRedraw = true;
}

waifuCanvas.setColour = function(colour) {
    waifuColour = colour;
    needsRedraw = true;
}

waifuCanvas.blackout = function() {
    blackout = true;
    needsRedraw = true;
}

// for song changes
waifuCanvas.clearBlackout = function() {
    blackout = false;
    needsRedraw = true;
}

waifuCanvas.xBlur = function() {
    blurStart = audio.context.currentTime;
    blurDistance = blurAmount;
    xBlur = true;
    yBlur = false;
    needsRedraw = true;
}

waifuCanvas.yBlur = function() {
    blurStart = audio.context.currentTime;
    blurDistance = blurAmount;
    xBlur = false;
    yBlur = true;
    needsRedraw = true;
}