import {type EventListener} from './EventListener';
import {type Event} from './Event';

export interface EventDispatcher {
	registerListeners(...listeners: Array<EventListener<any>>): void;

	dispatchEventsAsync(...events: Array<Event<any, any>>): Promise<void>;

	dispatchEvents(...events: Array<Event<any, any>>): void;
}

class DefaultEventDispatcher implements EventDispatcher {
	private listeners: Record<string, Array<EventListener<any>>> = {};

	constructor(...listeners: Array<EventListener<any>>) {
		this.registerListeners(...listeners);
	}

	registerListeners(...listeners: Array<EventListener<any>>): void {
		for (const listener of listeners) {
			const eventsListenedTo = listener.eventTypes as string[];
			for (const eventType of eventsListenedTo) {
				const list = (eventType in this.listeners) ? this.listeners[eventType] : [];
				list.push(listener);
				this.listeners[eventType] = list;
			}
		}
	}

	async dispatchEventsAsync(...events: Array<Event<any, any>>): Promise<void> {
		const innerAsyncDispatch = async <T1 extends string, T2>(evt: Event<T1, T2>, listener: EventListener<T1>) => {
			await listener.react(evt);
		};

		const promises: Array<Promise<void>> = [];
		for (const evt of events) {
			const listOfListeners = this.listeners[evt.type] ?? [];
			const listenersOnAny = this.listeners.any ?? [];
			for (const listener of listOfListeners) {
				promises.push(innerAsyncDispatch(evt, listener));
			}

			for (const listener of listenersOnAny) {
				promises.push(innerAsyncDispatch(evt, listener));
			}
		}

		return await Promise.all(promises) as unknown as Promise<void>;
	}

	dispatchEvents(...events: Array<Event<any, any>>): void {
		const innerDispatch = <T1 extends string, T2>(evt: Event<T1, T2>, listener: EventListener<T1>) => {
			void listener.react(evt);
		};

		for (const evt of events) {
			const listOfListeners = this.listeners[evt.type] ?? [];
			const listenersOnAny = this.listeners.any ?? [];
			for (const listener of listOfListeners) {
				innerDispatch(evt, listener);
			}

			for (const listener of listenersOnAny) {
				innerDispatch(evt, listener);
			}
		}
	}
}

export const defaultEventDispatcher = new DefaultEventDispatcher();
