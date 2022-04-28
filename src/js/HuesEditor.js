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

import './ResourcePack';

import EditorMain from './HuesEditor/Main.svelte';

import xmlbuilder from 'xmlbuilder';
import * as zip from "@zip.js/zip.js";

(function(window, document) {
"use strict";

class HuesEditor {
    constructor(core, huesWin) {
        this.undoBuffer = [];
        this.redoBuffer = [];
        // Will be an array if many actions are performed in one undo
        this.batchUndoArray = null;

        // for storing respacks created with "new"
        this.respack = null;

        this.song = null;

        this.core = core;
        if(!core.settings.enableWindow) {
            return;
        }

        let container = huesWin.addTab("EDITOR");
        this.editor = new EditorMain({
            target: container,
            props: {
                huesRoot : this.core.root,
                soundManager: this.core.soundManager,
                // if the first window is the editor, the user doesn't want the extra click
                // but eh, maybe the performance impact really isn't that bad
                totallyDisabled: false,
                //totallyDisabled: this.core.settings.firstWindow != 'EDITOR',
            },
        });

        core.addEventListener("newsong", (song) => {
            this.song = song;
            this.editor.$set({
                independentBuild: song?.independentBuild,
                title: song?.title,
                source: song?.source,
                loop: song?.loop,
                build: song?.build,
                undoQueue: song?.undoQueue,
                redoQueue: song?.redoQueue,
                disabled: !song,
            });
        });

        core.soundManager.addEventListener("songloading", (promise, song) => {
            this.editor.$set({songLoadPromise: promise});
        });

        core.addEventListener("beat", (beatString, beatIndex) => {
            this.editor.$set({beatIndex: beatIndex});
        });

        // update any changed fields from the editor component
        this.editor.$on('update', event => {
            if(core.currentSong) {
                Object.assign(core.currentSong, event.detail);
                this.core.updateBeatLength();
                // We may have to go backwards in time
                this.core.recalcBeatIndex();
                //this.core.callEventListeners("newsong", core.currentSong);
            }
        });

        this.editor.$on('loadbuildup', event => this.loadAudio('build'));
        this.editor.$on('loadrhythm', event => this.loadAudio('loop'));
        this.editor.$on('songremove', event => this.removeAudio());
        this.editor.$on('songnew', event => this.newSong());
        this.editor.$on('savezip', event => this.saveZIP());
        this.editor.$on('savexml', event => this.saveXML());
        this.editor.$on('copyxml', event => this.copyXML());
    }

    other(section) {
        return {'build':'loop', 'loop':'build'}[section];
    }

    async loadAudio(section) {
        // If first load, this makes fresh, gets the core synced up
        this.newSong(this.song);

        // Have we just added a build to a song with a rhythm, or vice versa?
        // If so, link their lengths
        let newlyLinked = !this.song[section].sound && !!this.song[this.other(section)].sound;

        // Do we have a loop to play?
        if(this.song.loop.sound) {
            // Force refresh
            await this.core.soundManager.playSong(this.song, true, true);
            if(newlyLinked) {
                this.setIndependentBuild(false);
            }
            this.editor.resyncEditors();
            this.core.updateBeatLength();
            // We may have to go backwards in time
            this.core.recalcBeatIndex();
        }
    }

    removeAudio() {
        // Is the loop playable?
        if(this.song.loop.sound) {
            this.core.soundManager.playSong(this.song, true, true);
        } else {
            this.core.soundManager.stop();
        }
    }

    newSong(song) {
        if(!song) {
            song = {
                title:"Title",
                loop: {
                    chart:null,
                    sound:null,
                    fname:null,
                    nameWithExt:null,
                },
                build: {
                    chart:null,
                    sound:null,
                    fname:null,
                    nameWithExt:null,
                },
                source:"",
                enabled:true,
                charsPerBeat: null,
                // Because new songs are empty
                independentBuild: true};
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

        // Force independent build if only 1 source is present
        this.updateIndependentBuild();

        // Unlock beatmap lengths
        this.editor.$set({locked: false});

        // You probably don't want to lose it
        window.onbeforeunload = () => "Unsaved beatmap - leave anyway?";
    }

    updateIndependentBuild() {
        // Force independent build if only 1 source is present

        // Effectively `buildup ^ loop` - does only 1 exist?
        let hasBuild = !!this.song.build.sound;
        let hasLoop = !!this.song.loop.sound;
        if(hasBuild != hasLoop) {
            this.setIndependentBuild(true);
        }
    }

    setIndependentBuild(indep) {
        this.editor.$set({independentBuild: indep});
    }

    generateXML(root) {
        if(!this.song) {
            return null;
        }

        let xml;
        if(!root) {
            root = xmlbuilder.begin();
        }
        xml = root.ele('song', {'name': this.song.loop.fname});
        xml.ele('title', this.song.title);
        if(this.song.source) {
            xml.ele('source', this.song.source);
        }
        xml.ele('rhythm', this.song.loop.chart);
        if(this.song.build.sound) {
            xml.ele('buildup', this.song.build.fname);
            xml.ele('buildupRhythm', this.song.build.chart);
            if(this.song.independentBuild) {
                xml.ele('independentBuild', 'true');
            }
        }
        return root.end({ pretty: true});
    }

    downloadURI(uri, filename) {
        // http://stackoverflow.com/a/18197341
        let element = document.createElement('a');
        element.setAttribute('href', uri);
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    async addSectionToZip(zipWriter, section) {
        if(!section.sound) {
            return;
        }
        const u8 = new Uint8Array(section.sound);
        await zipWriter.add(section.nameWithExt, new zip.Uint8ArrayReader(u8));
    }

    async saveZIP() {
        let result = this.generateXML(xmlbuilder.create('songs'));
        if(!result) {
            return;
        }

        const zipWriter = new zip.ZipWriter(new zip.Data64URIWriter("application/zip"));
        await zipWriter.add("songs.xml", new zip.TextReader(result));
        await this.addSectionToZip(zipWriter, this.song.loop);
        await this.addSectionToZip(zipWriter, this.song.build);

        const dataURI = await zipWriter.close();

        this.downloadURI(
            dataURI,
            "0x40Hues - " + this.song.loop.fname + ".zip"
        );

        window.onbeforeunload = null;
    }

    saveXML() {
        let result = this.generateXML(xmlbuilder.create('songs'));
        if(!result) {
            return;
        }

        this.downloadURI(
            'data:text/plain;charset=utf-8,' + encodeURIComponent(result),
            "0x40Hues - " + this.song.loop.fname + ".xml"
        );

        window.onbeforeunload = null;
    }

    // http://stackoverflow.com/a/30810322
    copyXML() {
        let text = this.generateXML();

        // Clicking when disabled
        if(!text) {
            return;
        }

        let textArea = document.createElement("textarea");
        textArea.className = "copybox";

        textArea.value = text;

        document.body.appendChild(textArea);

        textArea.select();

        let success;

        try {
            success = document.execCommand('copy');
        } catch (err) {
            success = false;
        }

        document.body.removeChild(textArea);
        if(success) {
            this.editor.alert("Beatmap XML copied to clipboard!");
        } else {
            this.editor.alert("Copy failed! Try saving instead");
        }
    }
}

window.HuesEditor = HuesEditor;

})(window, document);
