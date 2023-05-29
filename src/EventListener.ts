import {type AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {type Event} from './Event.js';

export interface EventListener<T1 extends string[], E extends Event<T1[number], any>> {
	eventTypes: T1;
	react(event: E): AsyncTask<Error, void>;
}
