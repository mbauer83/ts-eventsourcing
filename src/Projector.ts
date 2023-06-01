import {type Optional} from '@mbauer83/ts-functional/src/Optional.js';
import {type AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {type Event} from './Event.js';
import {type Projection} from './Projection.js';

export interface Projector<T> {
	eventTypes: string[];
	/**
    * This method can be implemented to collect events in some internal or external storage and project to a new T
    * when the event given to `project` makes the collection fulfill some condition which allows construction of a new/updated T
    **/
	project(event: Event<any, any>): AsyncTask<Error, Optional<Projection<T>>>;
}

export class GenericProjector<T> implements Projector<T> {
	constructor(
		public readonly eventTypes: string[],
		protected readonly projector: (event: Event<any, any>) => AsyncTask<Error, Optional<Projection<T>>>,
	) {}

	project(event: Event<any, any>): AsyncTask<Error, Optional<Projection<T>>> {
		return this.projector(event);
	}
}
