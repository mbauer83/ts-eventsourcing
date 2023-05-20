import {EventListener} from "./EventListener";
import {Event} from "./Event";
import {Serializable, SerializableObject} from "./Serializable";

export interface EventDispatcher {
    registerListeners(...listeners: EventListener<any>[]): void;

    dispatchEventsAsync(...events: Event<any, any>[]): Promise<void>;

    dispatchEvents(...events: Event<any, any>[]): void;
}

class DefaultEventDispatcher implements EventDispatcher {
    private listeners: Record<string, EventListener<any>[]> = {};

    constructor(...listeners: EventListener<any>[]) {
        this.registerListeners(...listeners);
    }

    registerListeners(...listeners: EventListener<any>[]): void {
        for (const listener of listeners) {
            const eventsListenedTo = listener.eventTypes as string[];
            for (const eventType of eventsListenedTo) {
                const list = this.listeners.hasOwnProperty(eventType) ? this.listeners[eventType] : [];
                list.push(listener);
                this.listeners[eventType] = list;
            }
        }
    }

    async dispatchEventsAsync(...events: Event<any, any>[]): Promise<void> {
        const innerAsyncDispatch = async <T1 extends string, T2 extends Serializable | SerializableObject>(evt: Event<T1, T2>, listener: EventListener<T1>) => {
            await listener.react(evt);
        }
        const promises: Promise<void>[] = [];
        for (const evt of events) {
            const listOfListeners = this.listeners[evt.type] ?? [];
            const listenersOnAny = this.listeners['any'] ?? [];
            for (const listener of listOfListeners) {
                promises.push(innerAsyncDispatch(evt, listener));
            }
            for (const listener of listenersOnAny) {
                promises.push(innerAsyncDispatch(evt, listener));
            }
        }
        return await Promise.all(promises) as unknown as Promise<void>
    }

    dispatchEvents(...events: Event<any, any>[]): void {
        const innerDispatch = <T1 extends string, T2 extends Serializable | SerializableObject>(evt: Event<T1, T2>, listener: EventListener<T1>) => {
            listener.react(evt);
        }
        for (const evt of events) {
            const listOfListeners = this.listeners[evt.type] ?? [];
            const listenersOnAny = this.listeners['any'] ?? [];
            for (const listener of listOfListeners) {
                innerDispatch(evt, listener);
            }
            for (const listener of listenersOnAny) {
                innerDispatch(evt, listener);
            }
        }
    }
}

export const EventDispatcher = new DefaultEventDispatcher();