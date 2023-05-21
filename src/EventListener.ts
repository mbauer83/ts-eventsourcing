import {type Event} from './Event.js';

export interface EventListener<T1 extends string> {
	eventTypes: T1[];
	react(event: Event<T1, any>): Promise<void>;
}
