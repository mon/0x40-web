/* Copyright (c) 2015 William Toohey <will@mon.im>
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

function HuesWindow(root, defaults) {
    this.eventListeners = {
        /* callback windowshown(shown)
         *
         * When the window is shown, hidden or toggled this fires.
         * 'shown' is true if the window was made visible, false otherwise
         */
        windowshown : [],
        /* callback tabselected(tabName)
         *
         * The name of the tab that was selected
         */
        tabselected : []
    };
    
    this.hasUI = defaults.enableWindow;
    
    if(!this.hasUI)
        return;
    
    this.window = document.createElement("div");
    this.window.className = "hues-win-helper";
    root.appendChild(this.window);
    
    let actualWindow = document.createElement("div");
    actualWindow.className = "hues-win";
    this.window.appendChild(actualWindow);
    
    let closeButton = document.createElement("div");
    closeButton.className = "hues-win__closebtn";
    closeButton.onclick = this.hide.bind(this);
    actualWindow.appendChild(closeButton);
    
    this.tabContainer = document.createElement("div");
    this.tabContainer.className = "hues-win__tabs";
    actualWindow.appendChild(this.tabContainer);
    
    this.contentContainer = document.createElement("div");
    this.contentContainer.className = "hues-win__content";
    actualWindow.appendChild(this.contentContainer);
    
    this.contents = [];
    this.tabs = [];
    this.tabNames = [];

    
    if(defaults.showWindow) {
        this.show();
    } else {
        this.hide();
    }
}

HuesWindow.prototype.addTab = function(tabName, tabContent) {
    if(!this.hasUI)
        return;
    
    let label = document.createElement("div");
    label.textContent = tabName;
    label.className = "tab-label";
    label.onclick = this.selectTab.bind(this, tabName);
    this.tabContainer.appendChild(label);
    this.tabs.push(label);
    this.tabNames.push(tabName);
    
    let content = document.createElement("div");
    content.className = "tab-content";
    content.appendChild(tabContent);
    this.contentContainer.appendChild(content);
    this.contents.push(content);
};

HuesWindow.prototype.selectTab = function(tabName, dontShowWin) {
    if(!this.hasUI)
        return;
    if(!dontShowWin) {
        this.show();
    }
    for(let i = 0; i < this.tabNames.length; i++) {
        let name = this.tabNames[i];
        if(tabName.toLowerCase() == name.toLowerCase()) {
            this.contents[i].classList.add("tab-content--active");
            this.tabs[i].classList.add("tab-label--active");
            this.callEventListeners("tabselected", name);
        } else {
            this.contents[i].classList.remove("tab-content--active");
            this.tabs[i].classList.remove("tab-label--active");
        }
    }
};

HuesWindow.prototype.hide = function() {
    if(!this.hasUI)
        return;
    
    this.window.classList.add("hidden");
    this.callEventListeners("windowshown", false);
};

HuesWindow.prototype.show = function() {
    if(!this.hasUI)
        return;
    
    this.window.classList.remove("hidden");
    this.callEventListeners("windowshown", true);
};

HuesWindow.prototype.toggle = function() {
    if(!this.hasUI)
        return;
    if(this.window.classList.contains("hidden")) {
        this.show();
    } else {
        this.hide();
    }
};

HuesWindow.prototype.callEventListeners = function(ev) {
    let args = Array.prototype.slice.call(arguments, 1);
    this.eventListeners[ev].forEach(function(callback) {
        callback.apply(null, args);
    });
};

HuesWindow.prototype.addEventListener = function(ev, callback) {
    ev = ev.toLowerCase();
    if (typeof(this.eventListeners[ev]) !== "undefined") {
        this.eventListeners[ev].push(callback);
    } else {
        throw Error("Unknown event: " + ev);
    }
};

HuesWindow.prototype.removeEventListener = function(ev, callback) {
    ev = ev.toLowerCase();
    if (typeof(this.eventListeners[ev]) !== "undefined") {
        this.eventListeners[ev] = this.eventListeners[ev].filter(function(a) {
            return (a !== callback);
        });
    } else {
        throw Error("Unknown event: " + ev);
    }
};

window.HuesWindow = HuesWindow;

})(window, document);