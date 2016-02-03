/* Copyright (c) William Toohey <will@mon.im>
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
 
(function(window, document) {
"use strict";

function HuesEditor(core) {
    this.buildEditSize = 80; // pixels, including header
    this.buildEdit = null;
    this.loopEdit = null;
    this.editArea = null;
    this.wrapAt = 16;
    
    this.hilightWidth = 0;
    this.hilightHeight = 0;
    
    this.undoBuffer = [];
    this.redoBuffer = [];
    
    // for storing respacks created with "new"
    this.respack = null;
    // when we're actually following the playing song
    this.linked = false;
    
    this.core = core;
    this.root = document.getElementById("huesEditor");
    if(!this.root) {
        return;
    }
    if(!core.settings.defaults.noUI) {
        this.initUI();
        core.addEventListener("beat", this.onBeat.bind(this));
        core.addEventListener("newsong", this.onNewSong.bind(this));
    }
}

HuesEditor.prototype.initUI = function() {
    var titleButtons = document.createElement("div");
    titleButtons.id = "edit-titlebuttons";
    this.root.appendChild(titleButtons);
    this.saveBtn = this.createButton("Save XML", titleButtons, true);
    this.saveBtn.onclick = this.saveXML.bind(this);
    this.copyBtn = this.createButton("Copy XML", titleButtons, true);
    this.copyBtn.onclick = this.copyXML.bind(this);
    this.undoBtn = this.createButton("Undo", titleButtons, true);
    this.redoBtn = this.createButton("Redo", titleButtons, true);
    var help = this.createButton("Help?", titleButtons);
    help.style.backgroundColor = "rgba(0,160,0,0.3)";
    help.onclick = function() {
        window.open("http://0x40hues.blogspot.com/p/0x40-hues-creation-tutorial.html", '_blank');
    };
    
    this.topBar = document.createElement("div");
    this.topBar.id = "edit-topbar";
    this.root.appendChild(this.topBar);
    
    this.uiCreateInfo();
    this.uiCreateImport();
    this.root.appendChild(document.createElement("hr"));
    this.uiCreateEditArea();
    this.uiCreateControls();
    this.uiCreateVisualiser();
    
    window.addEventListener('resize', this.resize.bind(this));
    // Fix Chrome rendering - redraw on tab load
    document.getElementById("tab-editor").addEventListener("change", this.resize.bind(this));
    this.resize();
};

HuesEditor.prototype.resize = function(noHilightCalc) {
    this.root.style.height = (window.innerHeight - 200) + "px";
    var boxHeight = this.editArea.offsetHeight;
    var bHeadHeight = this.buildEdit._header.offsetHeight;
    var lHeadHeight = this.loopEdit._header.offsetHeight;
    var handleHeight = this.resizeHandle.offsetHeight;
    var minHeight = bHeadHeight;
    var maxHeight = boxHeight - handleHeight - lHeadHeight - bHeadHeight;
    var buildHeight = Math.min(maxHeight, Math.max(minHeight, this.buildEditSize - handleHeight));
    this.buildEdit.style.height = buildHeight + "px";
    this.buildEdit._box.style.height = (buildHeight - bHeadHeight) + "px";
    var loopHeight = maxHeight - buildHeight + lHeadHeight;
    this.loopEdit.style.height = loopHeight + "px";
    this.loopEdit._box.style.height = (loopHeight - lHeadHeight) + "px";
    
    // For window resizing down situation
    if(this.editArea.offsetHeight != boxHeight) {
        this.resize();
    }
    
    // Resize the time lock
    this.timeLock.style.height = (buildHeight + handleHeight) + "px";
    
    // Save to fix Chrome rendering and to enable right click to seek
    // We only resize on a window resize event, not when dragging the handle
    if(!noHilightCalc) {
        var hilight = document.createElement("div");
        hilight.className = "beat-hilight";
        hilight.innerHTML = "&block;";
        this.root.appendChild(hilight);
        this.hilightWidth = hilight.clientWidth;
        this.hilightHeight = hilight.clientHeight;
        this.editorWidth = this.loopEdit._beatmap.clientWidth;
        this.root.removeChild(hilight);
    }
}

HuesEditor.prototype.createTextInput = function(label, id, subtitle, parent) {
    var div = document.createElement("div");
    div.className = "edit-label";
    var caption = document.createElement("label");
    caption.innerHTML = label;
    caption.htmlFor = id;
    div.appendChild(caption);
    var container = document.createElement("span");
    container.className = "edit-textbox-container";
    var input = document.createElement("input");
    input.className = "edit-textbox";
    input.type = "text";
    input.id = id;
    input.value = subtitle;
    container.appendChild(input);
    div.appendChild(container);
    
    parent.appendChild(div);
    
    return input;
}

HuesEditor.prototype.createButton = function(label, parent, disabled, extraClass) {
    var button = document.createElement("span");
    button.className = "hues-button";
    if(disabled) {
        button.className += " disabled";
    }
    if(extraClass) {
        button.className += " " + extraClass;
    }
    button.innerHTML = label.toUpperCase();
    parent.appendChild(button);
    return button;
}

HuesEditor.prototype.uiCreateInfo = function() {
    var info = document.createElement("div");
    this.topBar.appendChild(info);
    info.id = "edit-info";
    
    var songUpdate = function(name) {
        if(!this.song ) {
            return;
        }
        this.song[name] = this[name].value;
        if(this.song != this.core.currentSong) {
            return;
        }
        this.core.callEventListeners("newsong", this.song);
    }
    
    this.title = this.createTextInput("Title:", "edit-title", "Song name", info);
    this.title.oninput = songUpdate.bind(this, "title");
    this.source = this.createTextInput("Link:&nbsp;", "edit-source", "Source link", info);
    this.source.oninput = songUpdate.bind(this, "source");
};

HuesEditor.prototype.onNewSong = function(song) {
    if(this.linked) {
        if(song == this.song) {
            // Because you can "edit current" before it loads
            this.updateInfo();
        } else {
            this.linked = false;
            // Clear beat hilight
            this.buildEdit._hilight.innerHTML = "&block;";
            this.loopEdit._hilight.innerHTML = "&block;";
            this.buildEdit._hilight.className = "beat-hilight hidden";
            this.loopEdit._hilight.className = "beat-hilight hidden";
        }
    }
}

HuesEditor.prototype.onBeat = function(map, index) {
    if(!this.song || this.core.currentSong != this.song) {
        return;
    }
    var editor;
    if(index < 0) {
        index += this.core.currentSong.buildupRhythm.length;
        editor = this.buildEdit;
        this.loopEdit._hilight.className = "beat-hilight hidden";
    } else {
        editor = this.loopEdit;
        if(this.song.buildup) {
            this.buildEdit._hilight.className = "beat-hilight hidden";
        }
    }
    editor._hilight.className = "beat-hilight";
    var offsetX = index % editor._breakAt;
    var offsetY = Math.floor(index / editor._breakAt);
    // Not computing width/height here due to Chrome bug
    editor._hilight.style.left = (offsetX * this.hilightWidth) + "px";
    editor._hilight.style.top = (offsetY * this.hilightHeight) + "px";
}

HuesEditor.prototype.reflow = function(editor, map) {
    if(!map) { // NOTHING TO SEE HERE
        editor._beatmap.textContent = "";
        editor._hilight.textContent = "[none]";
        editor._hilight.className = "beat-hilight";
        editor._hilight.style.top = "0";
        editor._hilight.style.left = "0";
        editor._beatCount.textContent = "0 beats";
        return;
    } else {
        editor._hilight.innerHTML = "&block;";
    }
    var charsPerLine = Math.floor(this.editorWidth / this.hilightWidth);
    // if it's too long to wrap, just give up
    var wrap = Math.min(this.wrapAt, charsPerLine);
    charsPerLine -= charsPerLine % wrap;
    editor._beatCount.textContent = map.length + " beats";
    // http://stackoverflow.com/a/27012001
    var regex = new RegExp("(.{" + charsPerLine + "})", "g");
    editor._beatmap.innerHTML = map.replace(regex, "$1<br />");
    editor._breakAt = charsPerLine;
}

HuesEditor.prototype.loadAudio = function(editor) {
    if(editor._fileInput.files.length < 1) {
        return;
    }
    // Disable load button TODO
    var file = editor._fileInput.files[0];
    // load audio
    this.blobToArrayBuffer(file)
    .then(buffer => {
        // If first load, this makes fresh, gets the core synced up
        this.newSong(this.song);
        
        this.song[editor._sound] = buffer;
        // Save filename for XML export
        var noExt = file.name.replace(/\.[^/.]+$/, "");
        if(editor._sound == "sound") {
            this.song.name = noExt;
        } else {
            this.song.buildupName = noExt;
        }
        // make empty map if needed
        if(!this.getText(editor)) {
            this.setText(editor, "x...o...x...o...");
        }
        // Do we have a loop to play?
        if(this.song.sound) {
            // Force refresh
            return this.core.soundManager.playSong(this.song, true, true);
        }
    }).then(() => {
        this.updateInfo();
        this.reflow(editor, this.getText(editor));
        this.core.updateBeatLength();
        // We may have to go backwards in time
        this.core.recalcBeatIndex();
    }).catch(error => {
        console.log(error);
        alert("Couldn't load song! Is it a LAME encoded MP3?");
    });
}

HuesEditor.prototype.blobToArrayBuffer = function(blob) {
    return new Promise((resolve, reject) => {
        var fr = new FileReader();
        fr.onload = () => {
            resolve(fr.result);
        };
        fr.onerror = () => {
            reject(new Error("File read failed!"));
        };
        fr.readAsArrayBuffer(blob);
    });
}

HuesEditor.prototype.newSong = function(song) {
    if(!song) {
        song = {"name":"Name",
           "title":"Title",
           "rhythm":"",
           "source":"",
           "sound":null,
           "enabled":true,
           "filename":null,
           "charsPerBeat": null};
       if(!this.respack) {
           this.respack = new Respack();
           this.respack.name = "Editor Respack";
           this.respack.author = "You!";
           this.respack.description = "An internal resourcepack for editing new songs";
           this.core.resourceManager.addPack(this.respack);
       }
       this.respack.songs.push(song);
       this.core.resourceManager.rebuildArrays();
       this.core.resourceManager.rebuildEnabled();
       this.core.setSongOject(song);
    }
    // Clear instructions
    this.buildEdit._hilight.className = "beat-hilight hidden";
    this.loopEdit._hilight.className = "beat-hilight hidden";
    
    // Clear helpful glows
    this.newSongBtn.classList.remove("glow");
    this.fromSongBtn.classList.remove("glow");
    
    this.clearUndoRedo();
    
    this.song = song;
    this.reflow(this.buildEdit, song.buildupRhythm);
    this.reflow(this.loopEdit, song.rhythm);
    this.title.value = song.title;
    this.source.value = song.source;
    
    // Unlock beatmap lengths
    this.setLocked(this.buildEdit, 0);
    this.setLocked(this.loopEdit, 0);
    
    this.linked = true;
    this.updateInfo();
}

HuesEditor.prototype.updateInfo = function() {
    if(!this.linked) {
        return;
    }
    
    var loopLen = this.core.soundManager.loopLength;
    var buildLen = this.core.soundManager.buildLength;
    var beatLen = (loopLen / this.song.rhythm.length) * 1000;
    
    this.loopLen.textContent = loopLen.toFixed(2);
    this.buildLen.textContent = buildLen.toFixed(2);
    this.beatLen.textContent = beatLen.toFixed(2);
    
    // Avoid a bunch of nested elses
    this.seekStart.className = "hues-button disabled";
    this.seekLoop.className = "hues-button disabled";
    this.saveBtn.className = "hues-button disabled";
    this.copyBtn.className = "hues-button disabled";
    this.buildEdit._removeBtn.className = "hues-button disabled";
    this.loopEdit._removeBtn.className = "hues-button disabled";
    
    if(this.song) {
        this.saveBtn.className = "hues-button";
        this.copyBtn.className = "hues-button";
        if(this.song.sound) {
            this.seekLoop.className = "hues-button";
            this.loopEdit._removeBtn.className = "hues-button";
            if(this.song.buildup) {
                this.seekStart.className = "hues-button";
                this.buildEdit._removeBtn.className = "hues-button";
            }
        }
    }
}

HuesEditor.prototype.pushUndo = function(name, editor, oldText, newText) {
    if(oldText == newText) {
        return;
    }
    this.redoBuffer = [];

    this.undoBuffer.push({songVar: name, editor: editor, text: oldText});
    while(this.undoBuffer.length > 50) {
        this.undoBuffer.pop();
    }
    this.updateUndoUI();
}

HuesEditor.prototype.undo = function() {
    this.undoRedo(this.undoBuffer, this.redoBuffer);
}

HuesEditor.prototype.redo = function() {
    this.undoRedo(this.redoBuffer, this.undoBuffer);
}

HuesEditor.prototype.undoRedo = function(from, to) {
    if(from.length == 0 || !this.song) {
        return;
    }
    // Remove old data
    var fromData = from.pop();
    // Make restore from current
    to.push({songVar: fromData.songVar, editor: fromData.editor, text: this.song[fromData.songVar]});
    // Restore to editor
    this.song[fromData.songVar] = fromData.text;
    this.reflow(fromData.editor, this.song[fromData.songVar]);
    this.updateUndoUI();
    this.updateHalveDoubleButtons();
    this.core.updateBeatLength();
    this.core.recalcBeatIndex();
}

HuesEditor.prototype.clearUndoRedo = function() {
    this.undoBuffer = [];
    this.redoBuffer = [];
    this.updateUndoUI();
}

HuesEditor.prototype.updateUndoUI = function() {
    this.undoBtn.className = "hues-button disabled";
    this.undoBtn.onclick = null;
    this.redoBtn.className = "hues-button disabled";
    this.redoBtn.onclick = null;
    
    if(this.undoBuffer.length > 0) {
        this.undoBtn.classList.remove("disabled");
        this.undoBtn.onclick = this.undo.bind(this);
    }
    if(this.redoBuffer.length > 0) {
        this.redoBtn.classList.remove("disabled");
        this.redoBtn.onclick = this.redo.bind(this);
    }
}

HuesEditor.prototype.halveBeats = function(editor) {
    if(!this.song || this.getText(editor).length < 2) {
        return;
    }
    this.setText(editor, this.song[editor._rhythm].replace(/(.)./g, "$1"));
}

HuesEditor.prototype.doubleBeats = function(editor) {
    if(!this.song || this.getText(editor).length == 0) {
        return;
    }
    this.setText(editor, this.song[editor._rhythm].replace(/(.)/g, "$1."));
}

HuesEditor.prototype.uiCreateImport = function() {
    var imports = document.createElement("div");
    this.topBar.appendChild(imports);
    imports.id = "edit-imports";
    
    var songEdits = document.createElement("div");
    imports.appendChild(songEdits);
    var newSongBtn = this.createButton("New song", songEdits, false, "glow");
    newSongBtn.onclick = () => {
        this.newSong();
    };
    this.newSongBtn = newSongBtn;
    var fromSong = this.createButton("Edit current song", songEdits, false, "glow");
    fromSong.onclick = () => {
        if(this.core.currentSong) {
            this.newSong(this.core.currentSong);
        }
    };
    this.fromSongBtn = fromSong;
    
    var songInfos = document.createElement("div");
    songInfos.className = "settings-individual";
    songInfos.id = "edit-songstats";
    imports.appendChild(songInfos);
    
    this.loopLen = this.uiCreateSongStat("Loop length (s):", "0.00", songInfos);
    this.buildLen = this.uiCreateSongStat("Build length (s):", "0.00", songInfos);
    this.beatLen = this.uiCreateSongStat("Beat length (ms):", "0.00", songInfos);
};

HuesEditor.prototype.uiCreateSongStat = function(name, value, parent) {
    var container = document.createElement("div");
    parent.appendChild(container);
    var label = document.createElement("span");
    label.textContent = name;
    container.appendChild(label);
    var valueSpan = document.createElement("span");
    valueSpan.textContent = value;
    valueSpan.className = "edit-songstat-value";
    container.appendChild(valueSpan);
    return valueSpan;
}

HuesEditor.prototype.uiCreateEditArea = function() {
    var editArea = document.createElement("div");
    this.editArea = editArea;
    editArea.id = "edit-area";
    this.root.appendChild(editArea);
    
    // Lock build/loop lengths
    this.timeLock = document.createElement("div");
    editArea.appendChild(this.timeLock);
    this.timeLock.id = "edit-timelock";
    this.timeLock.className = "hues-icon";
    // CHAIN, use &#xe904; for CHAIN-BROKEN
    this.createButton("&#xe905;", this.timeLock)
    this.buildEdit = this.uiCreateSingleEditor("Buildup&nbsp;", "buildup", "buildupRhythm", "edit-build", editArea);
    
    // drag handle
    var handleContainer = document.createElement("div");
    handleContainer.id = "edit-resize-handle-container";
    editArea.appendChild(handleContainer);
    var handle = document.createElement("div");
    handle.id = 'edit-resize-handle';
    handle.className = 'hues-icon';
    handle.innerHTML = "&#xe908;"; // DRAG HANDLE
    handleContainer.appendChild(handle);
    this.resizeHandle = handleContainer;
    
    handleContainer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        var editTop = this.editArea.getBoundingClientRect().top;
        var handleSize = this.resizeHandle.clientHeight;
        
        var resizer = (e) => {
            this.buildEditSize = Math.floor(e.clientY - editTop + handleSize/2);
            this.resize(true);
        };
        
        var mouseup = function(e) {
            document.removeEventListener("mousemove", resizer);
            document.removeEventListener("mouseup", mouseup);
        };
        
        document.addEventListener("mousemove", resizer);
        document.addEventListener("mouseup", mouseup);
    });

    this.loopEdit = this.uiCreateSingleEditor("Rhythm&nbsp;&nbsp;", "sound", "rhythm", "edit-loop", editArea);
    
    this.buildEdit._hilight.textContent = "[none]";
    this.loopEdit._hilight.innerHTML = 
        '<br />\
         Click [LOAD RHYTHM] to load a loop! LAME encoded MP3s work best.<br />\
         (LAME is important for seamless MP3 loops)<br />\
        <br />\
         [DOUBLE] doubles the selected map length by padding it with "."s.<br />\
         [HALVE] shortens the map length by removing every other character.<br />\
         [<< START] starts the song from the beginning.<br />\
         [< LOOP] starts the song from the start of the loop.<br />\
        <br />\
         You can also add a buildup with [LOAD BUILDUP], or remove it<br />\
         with [REMOVE].<br />\
        <br />\
         [NEW SONG] adds a completely empty song for you to edit, and<br />\
         [EDIT CURRENT SONG] takes the current playing song to the editor.<br />\
        <br />\
         [COPY/SAVE XML] allow for storing the rhythms and easy <br />\
         inclusion into a Resource Pack!';
};

HuesEditor.prototype.uiCreateSingleEditor = function(title, soundName, rhythmName, id, parent) {
    var container = document.createElement("div");
    container.id = id;
    parent.appendChild(container);
    
    var header = document.createElement("div");
    header.className = "edit-area-header";
    container.appendChild(header);
    
    var nameLabel = document.createElement("span");
    header.appendChild(nameLabel);
    nameLabel.innerHTML = title;
    var beatCount = document.createElement("span");
    header.appendChild(beatCount);
    beatCount.className = "beat-count";
    beatCount.textContent = "0 beats";
    container._lockedBtn = this.createButton("", header, false, "hues-icon");
    container._lockedBtn.onclick = () => {
        if(container._locked) {
            this.setLocked(container, 0);
        } else {
            var textLen = this.getText(container).length;
            this.setLocked(container, textLen);
        }
    };
    
    var rightHeader = document.createElement("span");
    rightHeader.className = "edit-area-right-header";
    header.appendChild(rightHeader);
    
    container._halveBtn = this.createButton("Halve", rightHeader);
    container._halveBtn.onclick = this.halveBeats.bind(this, container)
    container._doubleBtn = this.createButton("Double", rightHeader);
    container._doubleBtn.onclick = this.doubleBeats.bind(this, container)
    
    var fileInput = document.createElement("input");
    fileInput.type ="file";
    fileInput.accept="audio/mpeg3";
    fileInput.multiple = false;
    fileInput.onchange = this.loadAudio.bind(this, container);
    var load = this.createButton("Load " + title.replace(/&nbsp;/g,""), rightHeader);
    load.onclick = () => {fileInput.click()};
    
    container._removeBtn = this.createButton("Remove", rightHeader, true);
    
    var editBox = document.createElement("div");
    editBox.className = "edit-box";
    var beatmap = document.createElement("div");
    beatmap.className = "beatmap";
    beatmap.contentEditable = true;
    beatmap.spellcheck = false;
    beatmap.oninput = this.textUpdated.bind(this, container);
    beatmap.oncontextmenu = this.rightClick.bind(this, container);
    
    var beatHilight = document.createElement("div");
    beatHilight.className = "beat-hilight";
    
    editBox.appendChild(beatHilight);
    editBox.appendChild(beatmap);
    container.appendChild(editBox);
    
    container._header = header;
    container._beatCount = beatCount;
    container._box = editBox;
    container._beatmap = beatmap;
    container._hilight = beatHilight;
    container._fileInput = fileInput;
    
    container._sound = soundName;
    container._rhythm = rhythmName;
        
    // Are we in insert mode? Default = no
    this.setLocked(container, 0);
    
    return container;
}

HuesEditor.prototype.rightClick = function(editor, event) {
    // We abuse the fact that right clicking moves the caret. Hooray!
    var caret = this.getCaret(editor._beatmap);
    var totalLen = this.getText(editor).length;
    var percent = caret / totalLen;
    if(caret <= totalLen) {
        var seekTime = 0;
        if(editor._rhythm == "rhythm") { // loop
            seekTime = this.core.soundManager.loopLength * percent;
        } else { // build
            var bLen = this.core.soundManager.buildLength;
            seekTime = -bLen + bLen * percent;
        }
        this.core.soundManager.seek(seekTime);
        event.preventDefault();
        return false;
    } else {
        return true;
    }
}

HuesEditor.prototype.textUpdated = function(editor) {
    if(!this.song || !this.song[editor._sound]) {
        this.reflow(editor, "");
        return;
    }
    // Space at start of line is nonbreaking, get it with \u00a0
    var input = editor._beatmap.textContent.replace(/ |\u00a0/g, "");
    if(input.length == 0) {
        input = ".";
    }
    this.setText(editor, input);
}

HuesEditor.prototype.getText = function(editor) {
    if(!this.song || !this.song[editor._rhythm]) {
        return "";
    } else {
        return this.song[editor._rhythm];
    }
};

HuesEditor.prototype.setText = function(editor, text) {
    if(!this.song || !this.song[editor._sound]) {
        this.reflow(editor, "");
        return;
    }
    var caret = this.getCaret(editor._beatmap);
    if(editor._locked) {
        caret = Math.min(editor._locked, caret);
        if(text.length > editor._locked) {
            // Works for pastes too! Removes the different between sizes from the caret position
            text = text.slice(0, caret) + text.slice(caret + (text.length - editor._locked), text.length)
        } else {
            while(text.length < editor._locked) {
                text += ".";
            }
        }
    }
    this.pushUndo(editor._rhythm, editor, this.song[editor._rhythm], text);
    this.song[editor._rhythm] = text
    this.reflow(editor, this.song[editor._rhythm]);
    this.setCaret(editor._beatmap, caret);
    this.updateHalveDoubleButtons(editor);
    
    this.core.updateBeatLength();
    // We may have to go backwards in time
    this.core.recalcBeatIndex();
    this.updateInfo();
}

HuesEditor.prototype.getCaret = function(editable) {
    var caret = 0;
    var sel = window.getSelection();
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0);
      // <br> elements are empty, and pastes do weird things.
      // So don't go up in multiples of 2 for getCaret
      for(var i = 0; i < editable.childNodes.length; i++) {
          if (range.commonAncestorContainer == editable.childNodes[i]) {
              caret += range.endOffset;
            return caret;
          } else {
              caret += editable.childNodes[i].textContent.length;
          }
      }
    }
    return 0;
}

HuesEditor.prototype.setCaret = function(editable, caret) {
    var range = document.createRange();
    var sel = window.getSelection();
    // <br> elements mean children go up in multiples of 2
    for(var i = 0; i < editable.childNodes.length; i+= 2) {
        var textLen = editable.childNodes[i].textContent.length;
        if(caret > textLen) {
            caret -= textLen;
        } else {
            range.setStart(editable.childNodes[i], caret);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            break;
        }
    }
}

HuesEditor.prototype.updateHalveDoubleButtons = function(editor) {
    editor._halveBtn.className = "hues-button disabled";
    editor._doubleBtn.className = "hues-button disabled";
    
    if(!editor._locked) {
        var txtLen = this.getText(editor).length;
        if(txtLen > 0) {
            editor._doubleBtn.className = "hues-button";
        }
        if(txtLen > 1) {
            editor._halveBtn.className = "hues-button";
        }
    }
}

HuesEditor.prototype.setLocked = function(editor, locked) {
    editor._locked = locked;
    if(locked) {
        editor._lockedBtn.innerHTML = "&#xe906;"; // LOCKED
    } else {
        editor._lockedBtn.innerHTML = "&#xe907;"; // UNLOCKED
    }
    this.updateHalveDoubleButtons(editor);
}

HuesEditor.prototype.uiCreateControls = function() {
    var controls = document.createElement("div");
    controls.id = "edit-controls";
    this.root.appendChild(controls);
    
    this.seekStart = this.createButton("<< Start", controls, true);
    this.seekStart.onclick = () => {
        this.core.soundManager.seek(-this.core.soundManager.buildLength);
    };
    this.seekLoop = this.createButton("< Loop", controls, true);
    this.seekLoop.onclick = () => {
        this.core.soundManager.seek(0);
    };
    
    var playRateLab = document.createElement("span");
    playRateLab.className = "settings-individual";
    playRateLab.textContent = "1.00x";
    controls.appendChild(playRateLab);
    
    var changeRate = function(change) {
        var rate = this.core.soundManager.playbackRate;
        rate += change;
        this.core.soundManager.setRate(rate);
        // In case it gets clamped, check
        var newRate = this.core.soundManager.playbackRate;
        playRateLab.textContent = newRate.toFixed(2) + "x";
    }
    
    // BACKWARD
    var speedDown = this.createButton("&#xe909;", controls, false, "hues-icon");
    speedDown.onclick = changeRate.bind(this, -0.25);
    // FORWARD
    var speedUp = this.createButton("&#xe90a;", controls, false, "hues-icon");
    speedUp.onclick = changeRate.bind(this, 0.25);
    
    var wrapLab = document.createElement("span");
    wrapLab.className = "settings-individual";
    wrapLab.textContent = "New line at beat ";
    controls.appendChild(wrapLab);
    
    var wrapAt = document.createElement("input");
    wrapAt.className = "settings-input";
    wrapAt.value = this.wrapAt;
    wrapAt.type = "text";
    wrapAt.oninput = () => {
        wrapAt.value = wrapAt.value.replace(/\D/g,'');
        if(wrapAt.value == "" || wrapAt.value < 1) {
            wrapAt.value = "";
            return;
        }
        this.wrapAt = parseInt(wrapAt.value);
        this.reflow(this.buildEdit, this.song.buildupRhythm);
        this.reflow(this.loopEdit, this.song.rhythm);
        
    };
    controls.appendChild(wrapAt);
};

HuesEditor.prototype.uiCreateVisualiser = function() {
    // TODO placeholder
    var waveDiv = document.createElement("div");
    waveDiv.id = "edit-waveform";
    this.root.appendChild(waveDiv);
};

HuesEditor.prototype.generateXML = function() {
    if(!this.song) {
        return null;
    }
    // Yes, this is just a bunch of strings. Simple XML, simple method.

    var result = "  <song name=\"" + this.song.name + "\">\n";
    result += "    <title>" + this.song.title + "</title>\n";
    if(this.song.source) {
        result += "    <source>" + this.song.source + "</source>\n";
    }
	result += "    <rhythm>" + this.song.rhythm + "</rhythm>\n";
	if(this.song.buildup) {
        result += "    <buildup>" + this.song.buildupName + "</buildup>\n";
        result += "    <buildupRhythm>" + this.song.buildupRhythm + "</buildupRhythm>\n";
    }
	result += "  </song>\n";
    return result;
}

HuesEditor.prototype.saveXML = function() {
    var xml = this.generateXML();
    if(!xml) {
        return;
    }
    var result = "<songs>\n";
    result += xml;
    result += "</songs>\n";
    
    // http://stackoverflow.com/a/18197341
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(result));
    element.setAttribute('download', "0x40Hues - " + this.song.name + ".xml");

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

// http://stackoverflow.com/a/30810322
HuesEditor.prototype.copyXML = function() {
    var text = this.generateXML();
    
    // Clicking when disabled
    if(!text) {
        return;
    }
    
    var textArea = document.createElement("textarea");
    textArea.id = "edit-copybox";

    textArea.value = text;

    document.body.appendChild(textArea);

    textArea.select();
    
    var success;

    try {
        success = document.execCommand('copy');
    } catch (err) {
        success = false;
    }
    
    document.body.removeChild(textArea);
    if(success) {
        alert("Beatmap XML copied to clipboard!");
    } else {
        alert("Copy failed! Try saving instead");
    }
    
}
    
window.HuesEditor = HuesEditor;

})(window, document);