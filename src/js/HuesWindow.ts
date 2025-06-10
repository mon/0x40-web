import EventListener from "./EventListener";
import type { SettingsData } from "./HuesSettings.svelte";

type WindowEvents = {
  // When the window is shown, hidden or toggled this fires.
  // 'shown' is true if the window was made visible, false otherwise
  windowshown: (shown: boolean) => void;
  //The name of the tab that was selected
  tabselected: (tabName: string) => void;
};

export default class HuesWindow extends EventListener<WindowEvents> {
  hasUI: boolean;

  window: Element;
  tabContainer: Element;
  contentContainer: Element;
  contents: Element[];
  tabs: Element[];
  tabNames: string[];
  tabSelected?: string;

  constructor(root: Element, settings: SettingsData) {
    super();

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

    if (settings.showWindow) {
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
    if (tabContent) {
      content.appendChild(tabContent);
    }
    this.contentContainer.appendChild(content);
    this.contents.push(content);

    // for the slow Svelte migration - use this as the `target` in `new Component()`
    return content;
  }

  selectTab(tabName: string, dontShowWin?: boolean) {
    if (!this.hasUI) return;
    if (!dontShowWin) {
      this.show();
    }
    for (let i = 0; i < this.tabNames.length; i++) {
      let name = this.tabNames[i];
      if (tabName.toLowerCase() == name.toLowerCase()) {
        this.contents[i].classList.add("tab-content--active");
        this.tabs[i].classList.add("tab-label--active");
        this.tabSelected = name;
        this.callEventListeners("tabselected", name);
      } else {
        this.contents[i].classList.remove("tab-content--active");
        this.tabs[i].classList.remove("tab-label--active");
      }
    }
  }

  // If the window isn't shown, show it. If the tab isn't selected, select it.
  // If the window is shown AND the tab is selected, hide the window
  selectOrToggle(tabName: string) {
    if (!this.hasUI) return;

    if (tabName.toLowerCase() == this.tabSelected?.toLowerCase()) {
      this.toggle();
    } else {
      this.show();
      this.selectTab(tabName);
    }
  }

  hide() {
    this.window.classList.add("hidden");
    this.callEventListeners("windowshown", false);
  }

  show() {
    if (!this.hasUI) return;

    this.window.classList.remove("hidden");
    this.callEventListeners("windowshown", true);
  }

  toggle() {
    if (!this.hasUI) return;
    if (this.hidden) {
      this.show();
    } else {
      this.hide();
    }
  }

  get hidden() {
    return this.window.classList.contains("hidden");
  }
}
