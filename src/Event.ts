import {type Message} from './Message';
import {type Orderable} from './Orderable';

export type EventMetadata = Record<string, any> & {timestampMs: number; issuer: string};

export interface Event<Type extends string, MessageContent> extends Message<MessageContent>, Orderable<Event<Type, MessageContent>> {
	readonly metadata: EventMetadata;
	readonly type: Type;
}

export const defaultEventComparator = (event1: Event<any, any>, event2: Event<any, any>) => event1.metadata.timestampMs < event2.metadata.timestampMs
	? -1
	: (
		event1.metadata.timestampMs === event2.metadata.timestampMs
		    ? 0
		    : 1
	);
