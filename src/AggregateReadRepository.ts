import {type Optional, None, Some} from '@mbauer83/ts-functional/src/Optional.js';
import {type Either, Left, Right} from '@mbauer83/ts-functional/src/Either.js';
import {Task} from '@mbauer83/ts-functional/src/Task.js';
import {type DateRange} from '@mbauer83/ts-utils/src/date/DateRange.js';
import {type Event} from './Event.js';
import {VersionRange, type Aggregate} from './Aggregate.js';
import {type AggregateEventFilterData, type EventStorage} from './EventStorage.js';
import {
	type BasicDomainEvent,
	type InitializingDomainEvent,
	isBasicDomainEvent,
	isDomainEvent,
	isInitializingDomainEvent,
	type SnapshotDomainEvent,
	isSnapshotDomainEvent,
} from './DomainEvent.js';

export class AggregateReadRepository<AggregateTypeName extends string, T extends Aggregate<AggregateTypeName, unknown>> {
	private readonly aggregateOptionsById = new Map<string, Optional<Aggregate<AggregateTypeName, unknown>>>();

	constructor(public readonly aggregateType: AggregateTypeName, private readonly eventStorage: EventStorage) {}

	get(id: string): Task<Error, T> {
		const aggregateOptionFromStorage = this.aggregateOptionsById.get(id);
		if (aggregateOptionFromStorage?.isSome()) {
			return this.updateAggregateFromStorage(aggregateOptionFromStorage.getOrThrow(() => new Error('Aggregate option was none.')) as T)
				.map(aggregate => {
					this.aggregateOptionsById.set(id, new Some<T>(aggregate));
					return aggregate;
				});
		}

	    const getAggregateTask = this.getAggregateFromStorage(id);
		const savingGetAggregateTask = getAggregateTask.map(aggregate => {
			this.aggregateOptionsById.set(id, new Some<T>(aggregate));
			return aggregate;
		});

		return savingGetAggregateTask;
	}

	private updateAggregateFromStorage(aggregate: T): Task<Error, T> {
		// Get all events for versions after the current one, then apply them to the aggregate.
		const noneDateRange: None<DateRange> = None.for<DateRange>();
		const versionRange = new VersionRange(aggregate.version, undefined, false, false);
		const filterData: AggregateEventFilterData<AggregateTypeName> = {
			type: this.aggregateType,
			dateRange: noneDateRange,
			aggregateId: new Some<string>(aggregate.id),
			versionRange: new Some<VersionRange>(versionRange),
		};

		const eventsToApplyTask = this.eventStorage.produceEvents(filterData);
		return eventsToApplyTask.flatMap<T>(generator => {
			const eventsToApply = Array.from(generator);
			return aggregate.withAppliedEvents(eventsToApply as Array<BasicDomainEvent<AggregateTypeName, unknown, any>>) as Task<Error, T>;
		});
	}

	private getAggregateFromStorage(id: string): Task<Error, T> {
		const noneDateRange: None<DateRange> = None.for<DateRange>();
		const noneVersionRange: None<VersionRange> = None.for<VersionRange>();
		// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
		const thisAlias = this;
		const filterData: AggregateEventFilterData<AggregateTypeName> = {
			type: this.aggregateType,
			dateRange: noneDateRange,
			aggregateId: new Some<string>(id),
			versionRange: noneVersionRange,
		};
		return this.eventStorage.produceEvents(filterData).flatMap<T>(
			(gen): Task<Error, T> => {
				function getFromCompleteEventStream() {
					return thisAlias.handleCompleteEventStream(gen as Generator<Event<AggregateTypeName, any>>, id);
				}

				const consumeTask
					= new Task<
					Error,
					[
						(InitializingDomainEvent<AggregateTypeName, unknown, any> | SnapshotDomainEvent<AggregateTypeName, unknown, any>),
						Array<BasicDomainEvent<AggregateTypeName, unknown, any>>,
					]>(getFromCompleteEventStream);

				return consumeTask.flatMap(tuple => {
					const [baseEvent, otherEvents] = tuple;
					return baseEvent.getSnapshot().withAppliedEvents(otherEvents) as Task<Error, T>;
				});
			},
		);
	}

	private handleCompleteEventStream(
		invokedGen: Generator<Event<AggregateTypeName, any>>,
		id: string,
	): Either<Error, [(InitializingDomainEvent<AggregateTypeName, unknown, any> | SnapshotDomainEvent<AggregateTypeName, unknown, any>), Array<BasicDomainEvent<AggregateTypeName, unknown, any>>]> {
		let base: (InitializingDomainEvent<AggregateTypeName, unknown, any> | SnapshotDomainEvent<AggregateTypeName, unknown, any>) | undefined;
		const otherEvents: Array<BasicDomainEvent<AggregateTypeName, unknown, any>> = [];
		for (const event of invokedGen) {
			if (isDomainEvent(event)) {
				if (isInitializingDomainEvent(event) || isSnapshotDomainEvent(event)) {
					base = event;
				} else if (isBasicDomainEvent(event)) {
					otherEvents.push(event);
				}
			}
		}

		return (base === undefined)
			? new Left(new Error('Could not find initial event or snapshot event as base for id ' + id))
			: new Right([base, otherEvents]);
	}
}
