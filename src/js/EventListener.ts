interface Event {
    [ev: string]: ((...args: any[]) => void)[];
}

export default class EventListener<Events extends Event> {
    eventListeners: Events;

    // can't work out how to make this automatic so just let the caller
    // initialise it
    constructor(listeners: Events) {
        this.eventListeners = listeners;
    }

    callEventListeners<E extends keyof Events>(ev: E, ...args: any) {
        for(const callback of this.eventListeners[ev]) {
            callback(...args);
        }
    }

    addEventListener<E extends keyof Events>(ev: E, callback: Events[E][number]) {
        this.eventListeners[ev].push(callback);
    }

    removeEventListener<E extends keyof Events>(ev: E, callback: Events[E][number]) {
        this.eventListeners[ev] = this.eventListeners[ev].filter(function(a) {
            return (a !== callback);
        }) as Events[E];
    }
}
