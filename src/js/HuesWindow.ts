import EventListener from './EventListener';
import type { HuesSettings } from './HuesSettings';

type WindowEvents = {
    // When the window is shown, hidden or toggled this fires.
    // 'shown' is true if the window was made visible, false otherwise
    windowshown: ((shown: boolean) => void)[];
    //The name of the tab that was selected
    tabselected: ((tabName: string) => void)[];
}

export default class HuesWindow extends EventListener<WindowEvents> {
    hasUI: boolean;

    window: Element;
    tabContainer: Element;
    contentContainer: Element;
    contents: Element[];
    tabs: Element[];
    tabNames: string[];

    constructor(root: Element, settings: HuesSettings) {
        super({
            windowshown : [],
            tabselected : []
        });

        this.hasUI = settings.enableWindow;

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


        if(settings.showWindow) {
            this.show();
        } else {
            this.hide();
        }
    }

    addTab(tabName: string, tabContent?: Element) {
        let label = document.createElement("div");
        label.textContent = tabName;
        label.className = "tab-label";
        label.onclick = () => this.selectTab(tabName);
        this.tabContainer.appendChild(label);
        this.tabs.push(label);
        this.tabNames.push(tabName);

        let content = document.createElement("div");
        content.className = "tab-content";
        if(tabContent) {
            content.appendChild(tabContent);
        }
        this.contentContainer.appendChild(content);
        this.contents.push(content);

        // for the slow Svelte migration - use this as the `target` in `new Component()`
        return content;
    }

    selectTab(tabName: string, dontShowWin?: boolean) {
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
    }

    hide() {
        if(!this.hasUI)
            return;

        this.window.classList.add("hidden");
        this.callEventListeners("windowshown", false);
    }

    show() {
        if(!this.hasUI)
            return;

        this.window.classList.remove("hidden");
        this.callEventListeners("windowshown", true);
    }

    toggle() {
        if(!this.hasUI)
            return;
        if(this.window.classList.contains("hidden")) {
            this.show();
        } else {
            this.hide();
        }
    }
}
