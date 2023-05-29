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
} from './DomainEvent';

export class AggregateReadRepository<AggregateType extends string> {
	private readonly aggregateOptionsById = new Map<string, Optional<Aggregate<AggregateType, unknown>>>();

	constructor(public readonly aggregateType: AggregateType, private readonly eventStorage: EventStorage) {}

	get(id: string): Task<Error, Aggregate<AggregateType, unknown>> {
		const aggregateOptionFromStorage = this.aggregateOptionsById.get(id);
		if (aggregateOptionFromStorage?.isSome()) {
			return this.updateAggregateFromStorage(aggregateOptionFromStorage.getOrThrow(() => new Error('Aggregate option was none.')))
				.map(aggregate => {
					this.aggregateOptionsById.set(id, new Some<Aggregate<AggregateType, unknown>>(aggregate));
					return aggregate;
				});
		}

	    const getAggregateTask = this.getAggregateFromStorage(id);
		const savingGetAggregateTask = getAggregateTask.map(aggregate => {
			this.aggregateOptionsById.set(id, new Some<Aggregate<AggregateType, unknown>>(aggregate));
			return aggregate;
		});
		return savingGetAggregateTask;
	}

	private updateAggregateFromStorage(aggregate: Aggregate<AggregateType, unknown>): Task<Error, Aggregate<AggregateType, unknown>> {
		// Get all events for versions after the current one, then apply them to the aggregate.
		const noneDateRange: None<DateRange> = None.for<DateRange>();
		const versionRange = new VersionRange(aggregate.version, undefined, false, false);
		const filterData: AggregateEventFilterData<AggregateType> = {
			type: this.aggregateType,
			dateRange: noneDateRange,
			aggregateId: new Some<string>(aggregate.id),
			versionRange: new Some<VersionRange>(versionRange),
		};

		const eventsToApplyTask = this.eventStorage.produceEvents(filterData);
		return eventsToApplyTask.flatMap(generator => {
			const eventsToApply = Array.from(generator);
			return aggregate.withAppliedEvents(eventsToApply as Array<BasicDomainEvent<AggregateType, unknown, any>>);
		});
	}

	private getAggregateFromStorage(id: string): Task<Error, Aggregate<AggregateType, unknown>> {
		const noneDateRange: None<DateRange> = None.for<DateRange>();
		const noneVersionRange: None<VersionRange> = None.for<VersionRange>();
		// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
		const thisAlias = this;
		const filterData: AggregateEventFilterData<AggregateType> = {
			type: this.aggregateType,
			dateRange: noneDateRange,
			aggregateId: new Some<string>(id),
			versionRange: noneVersionRange,
		};
		return this.eventStorage.produceEvents(filterData).flatMap<Aggregate<AggregateType, unknown>>(
			(gen): Task<Error, Aggregate<AggregateType, unknown>> => {
				function getFromCompleteEventStream() {
					return thisAlias.handleCompleteEventStream(gen as Generator<Event<AggregateType, any>>, id);
				}

				const consumeTask
					= new Task<
					Error,
					[
						(InitializingDomainEvent<AggregateType, unknown, any> | SnapshotDomainEvent<AggregateType, unknown, any>),
						Array<BasicDomainEvent<AggregateType, unknown, any>>,
					]>(getFromCompleteEventStream);

				return consumeTask.flatMap(tuple => {
					const [baseEvent, otherEvents] = tuple;
					return baseEvent.getSnapshot().withAppliedEvents(otherEvents);
				});
			},
		);
	}

	private handleCompleteEventStream(
		invokedGen: Generator<Event<AggregateType, any>>,
		id: string,
	): Either<Error, [(InitializingDomainEvent<AggregateType, unknown, any> | SnapshotDomainEvent<AggregateType, unknown, any>), Array<BasicDomainEvent<AggregateType, unknown, any>>]> {
		let base: (InitializingDomainEvent<AggregateType, unknown, any> | SnapshotDomainEvent<AggregateType, unknown, any>) | undefined;
		const otherEvents: Array<BasicDomainEvent<AggregateType, unknown, any>> = [];
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
