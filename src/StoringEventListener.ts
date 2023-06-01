import {type AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {type Event} from './Event';
import {type EventListener} from './EventListener.js';
import {type AsyncEventStorage} from './EventStorage';

export class StoringEventListener implements EventListener<['any'], Event<any, any>> {
	public readonly eventTypes: ['any'] = ['any'];

	constructor(private readonly storage: AsyncEventStorage) {}

	react(event: Event<any, any>): AsyncTask<Error, void> {
		return this.storage.storeEventsAsync(event);
	}
}
