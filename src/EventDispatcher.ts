
import {type AsyncIO} from '@mbauer83/ts-functional/src/AsyncIO.js';
import {AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {Task} from '@mbauer83/ts-functional/src/Task.js';
import {type Either, Left, Right} from '@mbauer83/ts-functional/src/Either.js';
import {type EventListener} from './EventListener.js';
import {type Event} from './Event.js';

export interface EventDispatcher {
	registerListeners(...listeners: Array<EventListener<any>>): Task<Error, void>;

	unregisterListeners(...listeners: Array<EventListener<any>>): Task<Error, void>;

	dispatchEventsAsync(...events: Array<Event<any, any>>): AsyncTask<Error, void>;

	dispatchEvents(...events: Array<Event<any, any>>): Task<Error, void>;
}

class DefaultEventDispatcher implements EventDispatcher {
	private listeners: Record<string, Array<EventListener<any>>> = {};

	constructor(...listeners: Array<EventListener<any>>) {
		this.registerListeners(...listeners);
	}

	registerListeners(...listeners: Array<EventListener<any>>): Task<Error, void> {
		const resolver = (..._: any[]): Either<Error, void> => {
			for (const listener of listeners) {
				const eventsListenedTo = listener.eventTypes as string[];
				for (const eventType of eventsListenedTo) {
					const list = (eventType in this.listeners) ? this.listeners[eventType] : [];
					list.push(listener);
					this.listeners[eventType] = list;
				}
			}

			return new Right<Error, void>(undefined);
		};

		return new Task(resolver);
	}

	unregisterListeners(...listeners: Array<EventListener<any>>): Task<Error, void> {
		const resolver = (..._: any[]): Either<Error, void> => {
			for (const listener of listeners) {
				const eventsListenedTo = listener.eventTypes as string[];
				for (const eventType of eventsListenedTo) {
					const list = (eventType in this.listeners) ? this.listeners[eventType] : [];
					const index = list.indexOf(listener);
					if (index !== -1) {
						list.splice(index, 1);
					}

					this.listeners[eventType] = list;
				}
			}

			return new Right<Error, void>(undefined);
		};

		return new Task(resolver);
	}

	dispatchEventsAsync(...events: Array<Event<any, any>>): AsyncTask<Error, void> {
		const innerDispatch = <T1 extends string, T2>(evt: Event<T1, T2>, listener: EventListener<T1>): AsyncIO<void> => listener.react(evt);
		const resolver = async (..._: any[]): Promise<Either<Error, void>> => {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const asyncIOs: Array<AsyncIO<void>> = [];
			try {
				for (const evt of events) {
					const listOfListeners = this.listeners[evt.getType()] ?? [];
					const listenersOnAny = this.listeners.any ?? [];
					for (const listener of listOfListeners) {
						asyncIOs.push(innerDispatch(evt, listener));
					}

					for (const listener of listenersOnAny) {
						asyncIOs.push(innerDispatch(evt, listener));
					}
				}

				const resolutions = asyncIOs.map(async (asyncIO: AsyncIO<void>) => asyncIO.evaluate());
				const allPromise = Promise.all(resolutions).then(() => undefined);
				// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
				return new Right<Error, void>(await allPromise);
			} catch (error) {
				const finalError = (error instanceof Error) ? error : new Error(JSON.stringify(error));
				return new Left<Error, void>(finalError);
			}
		};

		return new AsyncTask(resolver);
	}

	dispatchEvents(...events: Array<Event<any, any>>): Task<Error, void> {
		const innerDispatch = <T1 extends string, T2>(evt: Event<T1, T2>, listener: EventListener<T1>): AsyncIO<void> => listener.react(evt);
		const resolver = (..._: any[]): Either<Error, void> => {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const asyncIOs: Array<AsyncIO<void>> = [];
			try {
				for (const evt of events) {
					const listOfListeners = this.listeners[evt.getType()] ?? [];
					const listenersOnAny = this.listeners.any ?? [];
					for (const listener of listOfListeners) {
						asyncIOs.push(innerDispatch(evt, listener));
					}

					for (const listener of listenersOnAny) {
						asyncIOs.push(innerDispatch(evt, listener));
					}
				}

				const resolutions = asyncIOs.map(async (asyncIO: AsyncIO<void>) => asyncIO.evaluate());
				void Promise.all(resolutions);
				return new Right<Error, void>(undefined);
			} catch (error) {
				const finalError = (error instanceof Error) ? error : new Error(JSON.stringify(error));
				return new Left<Error, void>(finalError);
			}
		};

		return new Task(resolver);
	}
}

export const defaultEventDispatcher = new DefaultEventDispatcher();
