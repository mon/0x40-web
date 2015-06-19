var canvas;
var needsRedraw = false;

var waifuImgs = new Array();
var waifuColour = "#FFF";

var blurDecay, blurAmount, blurIterations, blurMin, blurMax, blurDelta; // set later
// dynamic
var blurStart = 0;
var blurDistance = 0;
var xBlur = false;
var yBlur = false;

var blackout = false;
var shortBlackout = false;
var blackoutColour = "#000"; // for the whiteout character
var blackoutTimeout;

waifuCanvas = {};

waifuCanvas.init = function() {
    waifuCanvas.blendMode = "hard-light";
    waifuCanvas.setBlurAmount(15);
    waifuCanvas.setBlurIterations(31);
    waifuCanvas.setBlurDecay(25);
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
    var bOpacity;
    var width = canvas.canvas.width;
    var image = waifuImgs[nCurrentWaifu];
    
    var cTime = audio.context.currentTime;
    // white BG for the hard light filter
    canvas.globalAlpha = 1;
    canvas.globalCompositeOperation = "source-over";
    if(blackout) {
        bOpacity = (cTime - blackoutStart)*10; // original is 3 frames, this is close
        if(bOpacity > 1) { // optimise the draw
            canvas.fillStyle = blackoutColour;
            canvas.fillRect(0,0,width,720);
            needsRedraw = false;
            return;
        }
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
        var delta = cTime - blurStart;
        blurDistance = blurAmount * Math.exp(-blurDecay * delta);
    }
    if(xBlur) {
        for(var i=blurMin; i<=blurMax; i+= blurDelta) {
            canvas.drawImage(image, Math.floor(blurDistance * i) + offset, 0);
        }
    } else if(yBlur) {
        for(var i=blurMin; i<=blurMax; i+= blurDelta) {
            canvas.drawImage(image, offset, Math.floor(blurDistance * i));
        }
    } else {
        canvas.globalAlpha = 1;
        canvas.drawImage(image, offset, 0);
    }
    canvas.globalAlpha = 0.7;
    canvas.fillStyle = waifuColour;
    canvas.globalCompositeOperation = waifuCanvas.blendMode;
    canvas.fillRect(0,0,width,720);
    if(blackout) {
        canvas.globalAlpha = bOpacity;
        canvas.fillStyle = blackoutColour;
        canvas.fillRect(0,0,width,720);
        needsRedraw = true;
    } else {
        needsRedraw = false;
    }
}

waifuCanvas.animationLoop = function() {
    if(blackoutTimeout && audio.context.currentTime > blackoutTimeout) {
        waifuCanvas.clearBlackout();
    }
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

waifuCanvas.blackout = function(whiteout) {
    if (typeof(whiteout)==='undefined') whiteout = false;
    if(whiteout) {
        blackoutColour = "#FFF";
    } else {
        blackoutColour = "#000";
    }
    blackoutTimeout = 0; // indefinite
    blackoutStart = audio.context.currentTime;
    blackout = true;
    needsRedraw = true;
}

// for song changes
waifuCanvas.clearBlackout = function() {
    blackout = false;
    blackoutTimeout = 0;
    needsRedraw = true;
}

waifuCanvas.shortBlackout = function(beatTime) {
    waifuCanvas.blackout();
    GetRandomWaifu();
    blackoutTimeout = audio.context.currentTime + beatTime / 1.7;
    // looks better if we go right to black
    blackoutStart = 0;
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

waifuCanvas.setBlurDecay = function(decay) {
    blurDecay = decay;
}

waifuCanvas.setBlurIterations = function(iterations) {
    blurIterations = iterations;
    blurDelta = blurAmount / blurIterations;
    blurAlpha = 1/(blurIterations/2);
}

waifuCanvas.setBlurAmount = function(amount) {
    blurAmount = amount;
    blurMin = -blurAmount/2;
    blurMax = blurAmount/2;
}