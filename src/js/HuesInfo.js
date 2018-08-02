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

(function(window, document) {
"use strict";

 /* HuesInfo.js populates the INFO tab in the Hues Window.
  */

const beatGlossary = [
    "x Vertical blur (snare)",
    "o Horizontal blur (bass)",
    "- No blur",
    "+ Blackout",
    "¤ Whiteout",
    "| Short blackout",
    ": Color only",
    "* Image only",
    "X Vertical blur only",
    "O Horizontal blur only",
    ") Trippy cirle in",
    "( Trippy circle out",
    "~ Fade color",
    "= Fade and change image",
    "i Invert all colours",
    "I Invert & change image",
    "s Horizontal slice",
    "S Horizontal slice and change image",
    "v Vertical slice",
    "V Vertical slice and change image",
    "# Double slice",
    "@ Double slice and change image"
];

const shortcuts = [
    "↑↓  Change song",
    "←→  Change image",
    "[N] Random song",
    "-+  Change volume",
    "[M] Toggle mute",
    "[B] Restart song from build",
    "[F] Toggle automode",
    "[H] Toggle UI hide",
    "[C] Character list",
    "[S] Song list",
    "[W] Toggle window",
    "[R] Resource packs",
    "[O] Options",
    "[I] Information",
    "[1-5] Change UI"
];

function populateHuesInfo(version, huesWin, settings) {
    if(!settings.enableWindow) {
        return;
    }
    let verString = (parseInt(version)/10).toFixed(1);

    let info = document.createElement("div");
    info.className = "hues-ref";

    let huesName = settings.huesName.replace("%VERSION%", version);
    let about = document.createElement("div");
    about.className = "hues-about";
    about.innerHTML = "<h1>" + huesName + "</h1>" +
        '<h2>Adapted from the <a target="_blank" href="http://0x40hues.blogspot.com">0x40 Flash</a></h2>' +
        '<h2>Web-ified by <a target="_blank" href="https://github.com/mon">mon</a></h2>' +
        '<h3>With help from <a target="_blank" href="https://github.com/kepstin/0x40hues-html5">Kepstin</a></h3>';
    info.appendChild(about);

    addReference(info, "Beat glossary", beatGlossary);
    addReference(info, "Keyboard shortcuts", shortcuts);

    huesWin.addTab("INFO", info);
}

let addReference = function(root, titleText, list) {
    let ref = document.createElement("div");
    ref.className = "hues-ref__info";
    root.appendChild(ref);

    let title = document.createElement("h3");
    title.textContent = titleText;
    ref.appendChild(title);

    let listElem = document.createElement("ul");
    list.forEach(function(elem) {
        let item = document.createElement("li");
        item.textContent = elem;
        listElem.appendChild(item);
    });
    ref.appendChild(listElem);
};

window.populateHuesInfo = populateHuesInfo;

})(window, document);