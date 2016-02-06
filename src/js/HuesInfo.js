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

 /* HuesInfo.js populates the beat glossary, shortcut list, and version string.
  * This means the HTML should rarely need to be updated.
  * If the element IDs are not present, the DOM is not modified. If you would
  * like a custom info page, simply leave them out.
  */

let huesInfo = {
    versionID: "versionText",
    referenceID: "reference",
    referenceClass: "info-ref"
};

let beatGlossary = [
    "x Vertical blur (snare)",
    "o Horizontal blur (bass)",
    "- No blur",
    "+ Blackout",
    "| Short blackout",
    ": Color only",
    "* Image only",
    "X Vertical blur only",
    "O Horizontal blur only",
    "~ Fade color",
    "= Fade and change image",
    "i Invert all colours",
    "I Invert & change image"
];

let shortcuts = [
    "↑↓  Change song",
    "←→  Change image",
    "[N] Random song",
    "-+  Change volume",
    "[M] Toggle mute",
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

function populateHuesInfo(version) {
    let versionInt = parseInt(version);
    
    let versionElem = document.getElementById(huesInfo.versionID);
    if(versionElem) {
        versionElem.textContent = "v" + (versionInt/10).toFixed(1);
    }
    
    addInfo("Beat glossary", beatGlossary);
    addInfo("Keyboard shortcuts", shortcuts);
}

let addInfo = function(titleText, list) {
    let refElem = document.getElementById(huesInfo.referenceID);
    if(!refElem) {
        return;
    }
    
    let info = document.createElement("div");
    info.className = huesInfo.referenceClass;
    refElem.appendChild(info);
    
    let title = document.createElement("h3");
    title.textContent = titleText;
    info.appendChild(title);
    
    let listElem = document.createElement("ul");
    list.forEach(function(elem) {
        let item = document.createElement("li");
        item.textContent = elem;
        listElem.appendChild(item);
    });
    info.appendChild(listElem);
};

window.populateHuesInfo = populateHuesInfo;

})(window, document);