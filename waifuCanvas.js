var canvas;
var needsRedraw = false;

var waifuImgs = new Array();
var waifuColour = "#FFF";

var blurTime = 8;
var blurIterations = 20;
var blurMin = -blurIterations/2;
var blurMax = blurIterations/2;
var blurDistance = 4;
var xBlur = 0;
var yBlur = 0;
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
    canvas.fillStyle = "#FFF";
    canvas.fillRect(0,0,width,720);
    
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
    
    if(xBlur) {
        canvas.globalAlpha = 1/blurIterations;
        for(var i=blurMin; i<blurMax; i++) {
            canvas.drawImage(image, blurDistance * i * xBlur + offset, 0);
        }
    } else if(yBlur) {
        canvas.globalAlpha = 1/blurIterations;
        for(var i=blurMin; i<blurMax; i++) {
            canvas.drawImage(image, offset, blurDistance * i * yBlur);
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
    if(xBlur) {
        xBlur--;
        waifuCanvas.redraw();
    }
    else if(yBlur) {
        yBlur--;
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

waifuCanvas.xBlur = function() {
    xBlur = blurTime;
    yBlur = 0;
    needsRedraw = true;
}

waifuCanvas.yBlur = function() {
    yBlur = blurTime;
    xBlur = 0;
    needsRedraw = true;
}

