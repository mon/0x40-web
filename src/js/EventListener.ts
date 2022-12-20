interface Event {
    [ev: string]: (...args: any[]) => any;
}

export default class EventListener<Events extends Event> {
    listeners: Partial<{
        // each event gets an array of event handlers
        [ev in keyof Events]: Set<Events[ev]>
    }>;

    constructor() {
        this.listeners = {};
    }

    callEventListeners<E extends keyof Events>(ev: E, ...args: any) {
        if(!(ev in this.listeners)) {
            return;
        }

        let ret = undefined;
        for(const callback of this.listeners[ev]!) {
            const callbackRet = callback(...args);
            if(callbackRet !== undefined) {
                ret = callbackRet;
            }
        }

        return ret;
    }

    addEventListener<E extends keyof Events>(ev: E, callback: Events[E]) {
        if(!(ev in this.listeners)) {
            this.listeners[ev] = new Set();
        }
        this.listeners[ev]!.add(callback);
    }

    removeEventListener<E extends keyof Events>(ev: E, callback: Events[E]) {
        if(!(ev in this.listeners)) {
            return;
        }
        this.listeners[ev]!.delete(callback);
    }
}
