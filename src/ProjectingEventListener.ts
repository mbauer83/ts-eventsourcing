import {type Either, Right, Left} from '@mbauer83/ts-functional/src/Either.js';
import {AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {type Optional} from '@mbauer83/ts-functional/src/Optional.js';
import {Task} from '@mbauer83/ts-functional/src/Task.js';
import {type Projector} from './Projector.js';
import {type EventListener} from './EventListener.js';
import {type Event} from './Event.js';
import {type AsyncProjectionRepository} from './ProjectionRepository.js';
import {type Projection} from './Projection.js';

export interface ProjectingEventListener extends EventListener<['any'], Event<any, any>> {
	registerProjectors(...projectors: Array<Projector<any>>): Task<Error, void>;
	unregisterProjectors(...projectors: Array<Projector<any>>): Task<Error, void>;
}

export class DefaultProjectingEventListener implements ProjectingEventListener {
	private projectors: Record<string, Array<Projector<any>>> = {};

	constructor(protected readonly projectionRepository: AsyncProjectionRepository, ...projectors: Array<Projector<any>>) {
		this.registerProjectors(...projectors);
	}

	get eventTypes(): ['any'] {
		return ['any'];
	}

	registerProjectors(...projectors: Array<Projector<any>>): Task<Error, void> {
		// Add each projector for all of its event types
		const resolver = (..._: any[]): Either<Error, void> => {
			for (const projector of projectors) {
				const eventsProjected = projector.eventTypes;
				for (const eventType of eventsProjected) {
					const list = (eventType in this.projectors) ? this.projectors[eventType] : [];
					list.push(projector);
					this.projectors[eventType] = list;
				}
			}

			return new Right<Error, void>(undefined);
		};

		return new Task(resolver);
	}

	unregisterProjectors(...projectors: Array<Projector<any>>): Task<Error, void> {
		const resolver = (..._: any[]): Either<Error, void> => {
			for (const projector of projectors) {
				const eventsProjected = projector.eventTypes;
				for (const eventType of eventsProjected) {
					const list = (eventType in this.projectors) ? this.projectors[eventType] : [];
					const index = list.indexOf(projector);
					if (index !== -1) {
						list.splice(index, 1);
					}

					this.projectors[eventType] = list;
				}
			}

			return new Right<Error, void>(undefined);
		};

		return new Task(resolver);
	}

	react(event: Event<any, any>): AsyncTask<Error, void> {
		// Get type of event, then get all projectors for that type,
		// as well as all projectors on 'any'.
		// For each projector, run its `project` method.
		// If the result is a Some of a Projection in a Right,
		// extract the Projection and save it in the repository.
		// Otherwise do nothing.
		const resolver = async (..._: any[]): Promise<Either<Error, void>> => {
			const eventType = event.getType() as string;
			const projectors = (eventType in this.projectors) ? this.projectors[eventType] : [];
			const projectorsForAny = this.projectors.any ?? [];
			const allProjectors = projectors.concat(projectorsForAny);

			const projectorPromises = [];
			for (const projector of allProjectors) {
				projectorPromises.push(projector.project(event).evaluate());
			}

			// Await all
			const projectorResults = await Promise.all(projectorPromises);

			// If there are Lefts (i.e. Errors), collect them into a single Error and return a left of the new error.
			const errors = projectorResults.filter((result: Either<Error, Optional<Projection<any>>>) => result.isLeft());
			if (errors.length > 0) {
				const errorMessage = 'Errors occurred while projecting: ' + JSON.stringify(
					errors.map((error: Either<Error, Optional<Projection<any>>>) => (error.get() as Error)),
					null,
					2,
				);

				return new Left<Error, void>(new Error(errorMessage));
			}

			// Results are to Either<Error, Optional<Projection<any>>>.
			// Filter out the Lefts and the Nones and map to Projections.
			const projections = projectorResults.filter(
				(result: Either<Error, Optional<Projection<any>>>) =>
					result.isRight() && result.get().isSome(),
			).map(
				(result: Either<Error, Optional<Projection<any>>>) =>
					(result.get() as Optional<Projection<any>>).getOrThrow(new Error('No ProjectionToGet')),
			);

			return this.projectionRepository.storeProjections(...projections).evaluate();
		};

		return new AsyncTask(resolver);
	}
}
