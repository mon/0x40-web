var canvas;
var needsRedraw = false;

var waifuImgs = new Array();

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
    canvas.drawImage(waifuImgs[0], 0, 0);
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
    canvas.clearRect(0,0,1280,720);
    
    if(xBlur) {
        canvas.globalAlpha = 1/blurIterations;
        for(var i=blurMin; i<blurMax; i++) {
            canvas.drawImage(waifuImgs[nCurrentWaifu], blurDistance * i * xBlur, 0);
        }
    } else if(yBlur) {
        canvas.globalAlpha = 1/blurIterations;
        for(var i=blurMin; i<blurMax; i++) {
            canvas.drawImage(waifuImgs[nCurrentWaifu], 0, blurDistance * i * yBlur);
        }
    } else {
        canvas.globalAlpha = 1;
        canvas.drawImage(waifuImgs[nCurrentWaifu], 0, 0);
    }
    
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
    var style = document.getElementById("waifu").style;
    style["margin-right"] = "auto";
    style["margin-left"] = "auto";
    switch(waifus[nCurrentWaifu].align) {
        case "left":
            style["margin-left"] = "0";
            break;
        case "right":
            style["margin-right"] = "0";
            break;
        default:
            break;
    }
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

