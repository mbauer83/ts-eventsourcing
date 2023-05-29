import {type Message} from './Message.js';
import {type Orderable} from './Orderable.js';

export type EventMetadata = Record<string, any> & {timestampMs: number; issuer: string};

export interface Event<Type extends string, EventPayload> extends Message<EventPayload>, Orderable<Event<Type, EventPayload>> {
	getMetadata(): EventMetadata;
	getType(): Type;
	getPayload(): EventPayload;
}

export class EventsCouldNotBeDispatchedError extends Error {
	constructor(message: string, public readonly events: Array<Event<any, any>>) {
		super(message);
	}
}

export type EventOrderable = Orderable<Event<any, unknown>>;

export const defaultEventComparator: EventOrderable = {
	compare(event1: Event<any, any>, event2: Event<any, any>): -1 | 0 | 1 {
		return event1.getMetadata().timestampMs < event2.getMetadata().timestampMs
			? -1
			: (
				event1.metadata.timestampMs === event2.metadata.timestampMs
					? 0
					: 1
			);
	},
} as const;
