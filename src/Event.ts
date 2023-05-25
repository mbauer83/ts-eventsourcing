import {type Message} from './Message.js';
import {type Orderable} from './Orderable.js';

export type EventMetadata = Record<string, any> & {timestampMs: number; issuer: string};

export interface Event<Type extends string, MessageContent> extends Message<MessageContent>, Orderable<Event<Type, MessageContent>> {
	readonly metadata: EventMetadata;
	readonly type: Type;
}

export type EventOrderable = Orderable<Event<any, unknown>>;

export const defaultEventComparator: EventOrderable = {
	compare(event1: Event<any, any>, event2: Event<any, any>): -1 | 0 | 1 {
		return event1.metadata.timestampMs < event2.metadata.timestampMs
			? -1
			: (
				event1.metadata.timestampMs === event2.metadata.timestampMs
					? 0
					: 1
			);
	},
} as const;
