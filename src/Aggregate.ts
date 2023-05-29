/* eslint-disable @typescript-eslint/parameter-properties */
import {type Either, Left, Right, eitherFromFnOrErrorFn} from '@mbauer83/ts-functional/src/Either.js';
import {Task} from '@mbauer83/ts-functional/src/Task.js';
import {isBasicCommand, type BaseCommandPayload, type Command, CommandDoesNotApplyToAggregateVersionError, type BasicCommand, type BasicCommandPayload} from './Command.js';
import {type BasicDomainEvent, type InitializingDomainEvent, type SnapshotDomainEvent} from './DomainEvent.js';
import {type EventDispatcher} from './EventDispatcher.js';
import {EventsCouldNotBeDispatchedError} from './Event.js';

export type AggregateType = string;

export class VersionRange {
	public static readonly empty = new VersionRange();

	constructor(
		public readonly minVersion: number | undefined = undefined,
		public readonly maxVersion: number | undefined = undefined,
		public readonly lowerBoundInclusive: boolean = false,
		public readonly upperBoundInclusive: boolean = false,
	) {}

	isInRange(version: number): boolean {
		return this.isWithinLowerBound(version) && this.isWithinUpperBound(version);
	}

	private readonly isWithinLowerBound: (version: number) => boolean = (version: number): boolean => {
		if (this.minVersion === undefined) {
			return true;
		}

		if (this.lowerBoundInclusive) {
			return version >= this.minVersion;
		}

		return version > this.minVersion;
	};

	private readonly isWithinUpperBound: (version: number) => boolean = (version: number): boolean => {
		if (this.maxVersion === undefined) {
			return true;
		}

		if (this.upperBoundInclusive) {
			return version <= this.maxVersion;
		}

		return version < this.maxVersion;
	};
}

export interface Aggregate<TypeName extends AggregateType, StateType> {
	readonly type: TypeName;
	readonly id: string;
	readonly state: StateType;
	readonly version: number;
	get<T extends keyof StateType>(propertyName: T): StateType[T];
	withAppliedEvents(events: Array<BasicDomainEvent<TypeName, StateType, any>>): Task<Error, Aggregate<TypeName, StateType>>;
	tryApplyCommand(command: Command<TypeName, StateType, any>, eventDispatcher: EventDispatcher): Task<Error, Aggregate<TypeName, StateType>>;
}

export abstract class BaseAggregate<Type extends AggregateType, State> {
	public readonly type: Type;

	public readonly id: string;

	public readonly state: State;

	public readonly version: number;

	protected constructor(
		type: Type,
		id: string,
		state: State,
		version = 0,
	) {
		this.type = type;
		this.id = id;
		// Copy instead of reference
		this.state = {...state};
		this.version = version;
	}

	get<K extends keyof State>(parameterName: K): State[K] {
		// Copy instead of potential reference
		return {...this.state[parameterName]};
	}

	withAppliedEvents(events: Array<BasicDomainEvent<Type, State, any>>): Task<Error, Aggregate<Type, State>> {
		const resolver = (): Either<Error, Aggregate<Type, State>> => {
			let currState = this.state;
			let currVersion = this.version;
			try {
				for (const evt of events) {
					currState = evt.apply(currState);
					currVersion = evt.getAggregateVersion();
				}

				return new Right(this.withState(currState, currVersion));
			} catch (error) {
				return new Left(error as Error);
			}
		};

		return new Task<Error, Aggregate<Type, State>>(resolver);
	}

	tryApplyCommand<T extends BaseCommandPayload<Type>>(command: Command<Type, State, T>, eventDispatcher: EventDispatcher): Task<Error, Aggregate<Type, State>> {
		const resolver = (): Either<Error, Aggregate<Type, State>> => {
			const trueOrWrongVersionError
				= eitherFromFnOrErrorFn(
					() => new CommandDoesNotApplyToAggregateVersionError(
						this.constructor.name,
						this.id,
						(command as BasicCommand<Type, State, T & BasicCommandPayload<Type>>).appliesToVersion(),
						this.version,
					),
					() => isBasicCommand(command) && command.appliesToVersion() === this.version,
				);

			const eventsOrError = trueOrWrongVersionError.flatMap(_ => this.eventsForCommand(command));
			const changedAggregate = eventsOrError.flatMap(events => this.withAppliedEvents(events).evaluate());
			if (changedAggregate.isRight()) {
				const events = eventsOrError.get() as Array<BasicDomainEvent<Type, State, any>>;
				const eventDispatchResult = eventDispatcher.dispatchEvents(...events).evaluate();
				if (eventDispatchResult.isLeft()) {
					return new Left<EventsCouldNotBeDispatchedError, Aggregate<Type, State>>(
						new EventsCouldNotBeDispatchedError(
							'Aggregate was modified, but events could not be dispatched.',
							events,
						),
					);
				}
			}

			return changedAggregate;
		};

		return new Task<Error, Aggregate<Type, State>>(resolver);
	}

	protected abstract withState(s: State, newVersion: number): Aggregate<Type, State>;
	protected abstract eventsForCommand<T extends BaseCommandPayload<Type>>(command: Command<Type, State, T>): Either<Error, Array<BasicDomainEvent<Type, State, any>>>;
}

// Since we create new state here, we can resolve immediately
export function createFromInitialEvent<TypeName extends AggregateType, StateType>(
	initialEvent: InitializingDomainEvent<TypeName, StateType, any>,
	...events: Array<BasicDomainEvent<TypeName, StateType, any>>
): Either<Error, Aggregate<TypeName, StateType>> {
	const initialAggregate = initialEvent.getSnapshot();
	return initialAggregate.withAppliedEvents(events).evaluate();
}

// Since we create new state here, we can resolve immediately
export function createFromSnapshot<TypeName extends AggregateType, StateType>(
	snapshotEvent: SnapshotDomainEvent<TypeName, StateType, any>,
	...events: Array<BasicDomainEvent<TypeName, StateType, any>>
): Either<Error, Aggregate<TypeName, StateType>> {
	const snapshotAggregate = snapshotEvent.getSnapshot();
	return snapshotAggregate.withAppliedEvents(events).evaluate();
}
