import {type Optional} from '@mbauer83/ts-functional/src/Optional.js';
import {Task} from '@mbauer83/ts-functional/src/Task.js';
import {AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {Left, Right} from '@mbauer83/ts-functional/src/Either.js';
import {type DateRange} from '@mbauer83/ts-utils/src/date/DateRange.js';
import {type Event} from './Event.js';
import {
	isSnapshotDomainEvent,
	type BasicDomainEvent,
	type DomainEvent,
	type InitializingDomainEvent,
	type SnapshotDomainEvent,
	isDomainEvent,
} from './DomainEvent.js';
import {type VersionRange, type AggregateType} from './Aggregate.js';

export type EventFilterData<T extends string> = {
	type: T;
	dateRange: Optional<DateRange>;
};

export type AggregateEventFilterData<T extends AggregateType> = EventFilterData<T> & {
	aggregateId: Optional<string>;
	versionRange: Optional<VersionRange>;
};

export type EventStorageGeneratorResult<T extends string, U extends EventFilterData<T> | AggregateEventFilterData<T>> =
	U extends AggregateEventFilterData<T> ? DomainEvent<T, unknown, any> : Event<T, any>;

export interface EventStorage {
	produceEvents<T extends string, U extends (EventFilterData<T> | AggregateEventFilterData<T>)>(
		filterData: U,
	): Task<Error, Generator<EventStorageGeneratorResult<T, U>>>;

	produceEventsAsync<T extends string, U extends (EventFilterData<T> | AggregateEventFilterData<T>)>(
		filterData: U,
	): AsyncTask<Error, AsyncGenerator<EventStorageGeneratorResult<T, U>>>;

	produceEventsForTypes<T extends string[], U extends Array<(EventFilterData<T[number]> | AggregateEventFilterData<T[number]>)>>(
		filterData: U,
	): Task<Error, Record<T[keyof T extends number ? number : never], Generator<EventStorageGeneratorResult<T[number], U[number]>>>>;

	produceEventsForTypesAsync<T extends AggregateType[], U extends Array<(EventFilterData<T[number]> | AggregateEventFilterData<T[number]>)>>(
		filterData: U,
	): AsyncTask<Error, Record<T[keyof T extends number ? number : never], AsyncGenerator<EventStorageGeneratorResult<T[number], U[number]>>>>;

	storeEvents(...events: Array<Event<any, any>>): AsyncTask<Error, void>;
}

export class InMemoryDomainEventStorage implements EventStorage {
	private readonly allApplicationEventsByType: Record<string, Array<Event<any, any>>> = {};
	private readonly allDomainEventsByTypeAndId: Record<string, Record<string, Array<DomainEvent<any, any, any>>>> = {};

	private basicDomainEventsByTypeAndId: Record<string, Record<string, Array<BasicDomainEvent<any, any, any>>>> = {};
	private snapshotDomainEventsByTypeAndId: Record<string, Record<string, Array<SnapshotDomainEvent<any, any, any>>>> = {};
	private initialDomainEventsByTypeAndId: Record<string, Record<string, InitializingDomainEvent<any, any, any>>> = {};

	storeEvents(...events: Array<Event<any, any>>): AsyncTask<Error, void> {
		const resolver = async (..._: any[]) => {
			for (const evt of events) {
				const eventType = evt.getType() as string;
				if (!isDomainEvent(evt)) {
					const list = this.allApplicationEventsByType[eventType] ?? [];
					list.push(evt);
					this.allApplicationEventsByType[eventType] = list;
					continue;
				}

				const record = this.allDomainEventsByTypeAndId[eventType] ?? {};
				const recordForId = record[evt.getAggregateId()] ?? [];
				recordForId.push(evt);
				record[evt.getAggregateId()] = recordForId;
				this.allDomainEventsByTypeAndId[eventType] = record;
				if (evt.isInitial()) {
					const aggregateId = evt.getAggregateId();
					if (eventType in this.initialDomainEventsByTypeAndId) {
						const byAggregateId = this.initialDomainEventsByTypeAndId[eventType];
						if (aggregateId in byAggregateId) {
							const error = new Error(`Initializing event already exists for type [${eventType}] and id [${aggregateId}].`);
							return new Left<Error, void>(error);
						}

						byAggregateId[aggregateId] = evt;
						this.initialDomainEventsByTypeAndId[eventType] = byAggregateId;
					}

					continue;
				}

				if (isSnapshotDomainEvent(evt)) {
					const aggregate = (evt as SnapshotDomainEvent<any, any, any>).getSnapshot();
					const aggregateId = aggregate.id;
					const byAggregateId = this.snapshotDomainEventsByTypeAndId[eventType] ?? {};
					const listForAggregateId = byAggregateId[aggregateId] ?? [];
					listForAggregateId.push(evt as SnapshotDomainEvent<any, any, any>);
					byAggregateId[aggregateId] = listForAggregateId;
					this.snapshotDomainEventsByTypeAndId[eventType] = byAggregateId;
				}

				const aggregateId = evt.getAggregateId();
				const byAggregateId = this.basicDomainEventsByTypeAndId[eventType] ?? {};
				const listForAggregateId: Array<BasicDomainEvent<any, any, any>> = byAggregateId[aggregateId] ?? [];
				listForAggregateId.push(evt as SnapshotDomainEvent<any, any, any>);
				byAggregateId[aggregateId] = listForAggregateId;
				this.basicDomainEventsByTypeAndId[eventType] = byAggregateId;
			}

			return new Right<Error, void>(undefined);
		};

		return new AsyncTask(resolver);
	}

	produceEvents<T extends string, U extends (EventFilterData<T> | AggregateEventFilterData<T>)>(
		filterData: U,
	): Task<Error, Generator<EventStorageGeneratorResult<T, U>>> {
		const resolver = () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const generator
				= (function * () {
					const sorted = newThis.getEventsForSingleType(filterData);
					for (const evt of sorted) {
						yield evt;
					}
				})() as Generator<EventStorageGeneratorResult<T, U>>;

			return new Right<Error, Generator<EventStorageGeneratorResult<T, U>>>(generator);
		};

		return new Task<Error, Generator<EventStorageGeneratorResult<T, U>>>(resolver);
	}

	produceEventsAsync<T extends string, U extends (EventFilterData<T> | AggregateEventFilterData<T>)>(
		filterData: U,
	): AsyncTask<Error, AsyncGenerator<EventStorageGeneratorResult<T, U>>> {
		const resolver = async () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const generator = (async function * () {
				const sorted = newThis.getEventsForSingleType(filterData);
				for (const evt of sorted) {
					yield evt;
				}
			})() as AsyncGenerator<EventStorageGeneratorResult<T, U>>;

			return new Right<Error, AsyncGenerator<EventStorageGeneratorResult<T, U>>>(generator);
		};

		return new AsyncTask<Error, AsyncGenerator<EventStorageGeneratorResult<T, U>>>(resolver);
	}

	produceEventsForTypes<T extends string[], U extends Array<(EventFilterData<T[number]> | AggregateEventFilterData<T[number]>)>>(
		filterData: U,
	): Task<Error, Record<T[keyof T extends number ? number : never], Generator<EventStorageGeneratorResult<T[number], U[number]>>>> {
		const resolver = () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const record: Record<AggregateType, Generator<EventStorageGeneratorResult<T[number], U[number]>>> = {};
			for (const filterDataForType of filterData) {
				const typeName = filterDataForType.type;
				record[typeName as string] = (function * () {
					const sorted = newThis.getEventsForSingleType(filterDataForType);
					for (const evt of sorted) {
						yield evt;
					}
				})() as Generator<EventStorageGeneratorResult<T[number], U[number]>>;
			}

			return new Right<Error, Record<T[number], Generator<EventStorageGeneratorResult<T[number], U[number]>>>>(record);
		};

		return new Task<Error, Record<T[number], Generator<EventStorageGeneratorResult<T[number], U[number]>>>>(resolver);
	}

	produceEventsForTypesAsync<T extends AggregateType[], U extends Array<(EventFilterData<T[number]> | AggregateEventFilterData<T[number]>)>>(
		filterData: U,
	): AsyncTask<Error, Record<T[keyof T extends number ? number : never], AsyncGenerator<EventStorageGeneratorResult<T[number], U[number]>>>> {
		const resolver = async () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const record: Record<AggregateType, AsyncGenerator<EventStorageGeneratorResult<T[number], U[number]>>> = {};
			for (const filterDataForType of filterData) {
				const typeName = filterDataForType.type;
				record[typeName as string] = (async function * () {
					const sorted = newThis.getEventsForSingleType(filterDataForType);
					for (const evt of sorted) {
						yield evt;
					}
				})() as AsyncGenerator<EventStorageGeneratorResult<T[number], U[number]>>;
			}

			return new Right<Error, Record<T[number], AsyncGenerator<EventStorageGeneratorResult<T[number], U[number]>>>>(record);
		};

		return new AsyncTask<Error, Record<T[number], AsyncGenerator<EventStorageGeneratorResult<T[number], U[number]>>>>(resolver);
	}

	protected filterByAggregateId<T extends AggregateType>(
		aggregateId: Optional<string>,
		list: Array<DomainEvent<T, any, any>>,
	): Array<DomainEvent<T, any, any>> {
		return aggregateId.match(
			id => list.filter(element => element.getAggregateId() === id),
			() => list,
		);
	}

	private getEventsForSingleType<T extends string, U extends (EventFilterData<T> | AggregateEventFilterData<T>)>(
		filterData: U,
	): Array<Event<T, unknown>> {
		const {type} = filterData;
		const dateRangeOption = filterData.dateRange;
		const aggregateId = 'aggregateId' in filterData ? filterData.aggregateId : undefined;
		const versionRangeOption = 'versionRange' in filterData ? filterData.versionRange : undefined;
		const forAggregate = aggregateId !== undefined;

		// If the query is for DomainEvents, we return the events from the lastest snapshot
		// for the aggregate if it exists, otherwise we return all events for the aggregate (initial + basic)
		if (forAggregate) {
			const snapshotEvents = this.snapshotDomainEventsByTypeAndId[type] ?? {};
			const flatMapDomainEvents = (snapshotEvents: Record<string, Array<DomainEvent<any, any, any>>>): Array<DomainEvent<any, any, any>> => {
				const snapshotEventsArray: Array<DomainEvent<any, any, any>> = [];
				for (const [, value] of Object.entries(snapshotEvents)) {
					snapshotEventsArray.push(...value);
				}

				return snapshotEventsArray;
			};

			const snapshotsForId = aggregateId.match(
				aggId => {
					const array = snapshotEvents[aggId] ?? [];
					return array;
				},
				() => {
					const mapped = flatMapDomainEvents(snapshotEvents) as Array<SnapshotDomainEvent<any, any, any>>;
					return mapped;
				},
			);
			const dateRangeFilteredSnapshots = dateRangeOption.match(
				dateRange => snapshotsForId.filter(
					event => dateRange.isInRange(event.getMetadata().timestampMs)),
				() => snapshotsForId,
			);
			const versionRangeFilteredSnapshots = versionRangeOption!.match(
				versionRange => dateRangeFilteredSnapshots.filter(
					event => versionRange.isInRange((event as DomainEvent<T, unknown, any>).getAggregateVersion()),
				),
				() => dateRangeFilteredSnapshots,
			);
			// Sort newest first
			const sortedSnapshots = versionRangeFilteredSnapshots.sort(
				(a, b) => b.getMetadata().timestampMs - a.getMetadata().timestampMs,
			);
			if (sortedSnapshots.length > 0) {
				// Determine datetime of latest snapshot,
				// then return snapshot events and basic events after that datetime
				const latestSnapshot = sortedSnapshots[0];
				const latestSnapshotTime = latestSnapshot.getMetadata().timestampMs;
				const basicEvents = this.allDomainEventsByTypeAndId[type] ?? {};
				const basicEventsForId = aggregateId.match(aggId => basicEvents[aggId] ?? [], () => flatMapDomainEvents(basicEvents) as Array<DomainEvent<T, unknown, any>>);
				const dateRangeFilteredBasicEvents = dateRangeOption.match(
					dateRange => basicEventsForId.filter(
						event => {
							const eventTimestamp = event.getMetadata().timestampMs;
							return dateRange.isInRange(eventTimestamp) && eventTimestamp > latestSnapshotTime;
						},
					),
					() => basicEventsForId,
				);

				const versionRangeFilteredBasicEvents = versionRangeOption!.match(
					versionRange => dateRangeFilteredBasicEvents.filter(
						event => versionRange.isInRange((event as DomainEvent<T, unknown, any>).getAggregateVersion()),
					),
					() => dateRangeFilteredBasicEvents,
				);

				// Sort oldest to newest
				const sortedBasicEvents = versionRangeFilteredBasicEvents.sort(
					(a, b) => a.getMetadata().timestampMs - b.getMetadata().timestampMs,
				);

				sortedBasicEvents.unshift(latestSnapshot);

				return sortedBasicEvents;
			}

			// No snapshots, return all events for aggregate and id
			const allDomainEventsForType = this.allDomainEventsByTypeAndId[type] ?? {};
			const allDomainEventsForTypeAndId = aggregateId.match(
				aggId => allDomainEventsForType[aggId] ?? [],
				() => flatMapDomainEvents(allDomainEventsForType) as Array<DomainEvent<T, unknown, any>>,
			);
			const dateRangeFilteredEvents = dateRangeOption.match(
				dateRange => allDomainEventsForTypeAndId.filter(
					event => dateRange.isInRange(event.getMetadata().timestampMs),
				),
				() => allDomainEventsForTypeAndId,
			);
			const versionRangeFilteredEvents = versionRangeOption!.match(
				versionRange => dateRangeFilteredEvents.filter(
					event => versionRange.isInRange((event as DomainEvent<T, unknown, any>).getAggregateVersion()),
				),
				() => dateRangeFilteredEvents,
			);

			return versionRangeFilteredEvents;
		}

		// For application events
		const allEventsForType = this.allApplicationEventsByType[type] ?? {};
		const allEventsForTypeDateFiltered = dateRangeOption.match(
			dateRange => allEventsForType.filter(
				event => dateRange.isInRange(event.getMetadata().timestampMs),
			),
			() => allEventsForType,
		);
		allEventsForTypeDateFiltered.sort(
			(a, b) => a.getMetadata().timestampMs - b.getMetadata().timestampMs,
		);

		return allEventsForTypeDateFiltered as Array<Event<T, unknown>>;
	}
}
