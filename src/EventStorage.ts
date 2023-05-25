import {type Optional} from '@mbauer83/ts-functional/src/Optional.js';
import {AsyncIO} from '@mbauer83/ts-functional/src/AsyncIO.js';
import {Task} from '@mbauer83/ts-functional/src/Task.js';
import {AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask.js';
import {Right} from '@mbauer83/ts-functional/src/Either.js';
import {defaultEventComparator, type Event} from './Event.js';
import {
	isSnapshotDomainEvent,
	type BasicDomainEvent,
	type DomainEvent,
	type InitializingDomainEvent,
	type SnapshotDomainEvent,
	isBasicDomainEvent,
	isDomainEvent,
} from './DomainEvent.js';

export interface EventStorage {
	produceEvents<T extends string>(
    	type: T,
    	aggregateId: Optional<string>,
    	fromDate: Optional<Date>,
    	fromVersion: Optional<number>,
	): Task<Error, () => Generator<Event<T, any>>>;

	produceEventsAsync<T extends string>(
    	type: T,
    	aggregateId: Optional<string>,
    	fromDate: Optional<Date>, fromVersion: Optional<number>,
	): AsyncTask<Error, () => AsyncGenerator<Event<T, any>>>;

	produceEventsForTypes<T extends string[]>(
    	typesAggregateIdsMinVersions: Array<[T[keyof T],
    	Optional<string>,
    	Optional<number>]>,
    	fromDate: Optional<Date>,
	): Task<Error, Record<number, () => Generator<Event<T[number], any>>>>;

	produceEventsForTypesAsync<T extends string[]>(
    	typesAggregateIdsMinVersions: Array<[T[keyof T], Optional<string>, Optional<number>]>,
    	fromDate: Optional<Date>,
	): AsyncTask<Error, Record<number, () => AsyncGenerator<Event<T[number], any>>>>;

	storeEvents(...events: Array<Event<any, any>>): AsyncIO<void>;
}

export class InMemoryDomainEventStorage implements EventStorage {
	private allEventsByType: Record<string, Array<Event<any, any>>> = {};
	private basicEventsByTypeAndId: Record<string, Record<string, Array<BasicDomainEvent<any, any, any>>>> = {};
	private snapshotEventsByTypeAndId: Record<string, Record<string, Array<SnapshotDomainEvent<any, any, any>>>> = {};
	private initialEventsByTypeAndId: Record<string, Record<string, InitializingDomainEvent<any, any, any>>> = {};

	storeEvents(...events: Array<DomainEvent<any, any, any>>): AsyncIO<void> {
		const resolver = async (..._: any[]) => {
			for (const evt of events) {
				const list = this.allEventsByType[evt.type] ?? [];
				list.push(evt);
				this.allEventsByType[evt.type] = list;
				if (evt.isInitial()) {
					const aggregateId = evt.getAggregateId();
					if (evt.type in this.initialEventsByTypeAndId) {
						const byAggregateId = this.initialEventsByTypeAndId[evt.type];
						if (aggregateId in byAggregateId) {
							throw new Error(`Initializing event already exists for type [${evt.type as string}] and id [${aggregateId}].`);
						}

						byAggregateId[aggregateId] = evt;
						this.initialEventsByTypeAndId[evt.type] = byAggregateId;
					}

					continue;
				}

				if (isSnapshotDomainEvent(evt)) {
					const aggregate = (evt as SnapshotDomainEvent<any, any, any>).snapshot;
					const aggregateId = aggregate.id;
					const byAggregateId = this.snapshotEventsByTypeAndId[evt.type] ?? {};
					const listForAggregateId = byAggregateId[aggregateId] ?? [];
					listForAggregateId.push(evt as SnapshotDomainEvent<any, any, any>);
					byAggregateId[aggregateId] = listForAggregateId;
					this.snapshotEventsByTypeAndId[evt.type] = byAggregateId;
					continue;
				}

				const aggregateId = evt.getAggregateId();
				const byAggregateId = this.basicEventsByTypeAndId[evt.type] ?? {};
				const listForAggregateId: Array<BasicDomainEvent<any, any, any>> = byAggregateId[aggregateId] ?? [];
				listForAggregateId.push(evt as SnapshotDomainEvent<any, any, any>);
				byAggregateId[aggregateId] = listForAggregateId;
				this.basicEventsByTypeAndId[evt.type] = byAggregateId;
			}
		};

		return new AsyncIO(resolver);
	}

	produceEvents<T extends string>(
    	type: T,
		aggregateId: Optional<string>,
		fromDate: Optional<Date>,
		fromVersion: Optional<number>,
	): Task<Error, () => Generator<Event<T, any>>> {
		const resolver = () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const generator = function * () {
				const list: Array<Event<T, any>> = newThis.allEventsByType[type] as Array<Event<T, any>> ?? [];
				const filteredByDate: Array<Event<T, any>> = fromDate.match(
					date => list.filter(element => element.metadata.timestampMs >= date.getTime()),
					() => list,
				);
				const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome())
					? newThis.filterByVersion(
						fromVersion,
						newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(element => isDomainEvent(element)) as Array<DomainEvent<T, any, any>>)),
					)
					: filteredByDate;

				const sorted = filteredByDomainEventCriteria.sort(defaultEventComparator.compare);
				for (const evt of sorted) {
					yield evt;
				}
			};

			return new Right<Error, () => Generator<Event<T, any>>>(generator);
		};

		return new Task<Error, () => Generator<Event<T, any>>>(resolver);
	}

	produceEventsAsync<T extends string>(
    	type: T,
		aggregateId: Optional<string>,
		fromDate: Optional<Date>, fromVersion: Optional<number>,
	): AsyncTask<Error, () => AsyncGenerator<Event<T, any>>> {
		const resolver = async () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const generator = async function * () {
				const list: Array<Event<T, any>> = newThis.allEventsByType[type] as Array<Event<T, any>> ?? [];
				const filteredByDate: Array<Event<T, any>> = fromDate.match(
					date => list.filter(element => element.metadata.timestampMs >= date.getTime()),
					() => list,
				);
				const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome())
					? newThis.filterByVersion(
						fromVersion,
						newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(element => isDomainEvent(element)) as Array<DomainEvent<T, any, any>>)),
					)
					: filteredByDate;

				const sorted = filteredByDomainEventCriteria.sort(defaultEventComparator.compare);
				for (const evt of sorted) {
					yield evt;
				}
			};

			return new Right<Error, () => AsyncGenerator<Event<T, any>>>(generator);
		};

		return new AsyncTask<Error, () => AsyncGenerator<Event<T, any>>>(resolver);
	}

	produceEventsForTypes<T extends string[]>(
    	typesAggregateIdsMinVersions: Array<[T[keyof T], Optional<string>, Optional<number>]>,
    	fromDate: Optional<Date>,
	): Task<Error, Record<number, () => Generator<Event<T[number], any>>>> {
		const resolver = () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const record: Record<string, () => Generator<Event<any, any>>> = {};
			for (const [typeName, aggregateId, fromVersion] of typesAggregateIdsMinVersions) {
				const generator = function * () {
					const list: Array<Event<any, any>> = newThis.allEventsByType[typeName as string] ?? [];
					const filteredByDate: Array<Event<any, any>> = fromDate.match(
						date => list.filter(element => element.metadata.timestampMs >= date.getTime()),
						() => list,
					);
					const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome())
						? newThis.filterByVersion(
							fromVersion,
							newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(element => isDomainEvent(element)) as Array<DomainEvent<any, any, any>>)),
						)
						: filteredByDate;

					const sorted = filteredByDomainEventCriteria.sort(defaultEventComparator.compare);
					for (const evt of sorted) {
						yield evt;
					}
				};

				record[typeName as string] = generator;
			}

			return new Right<Error, Record<number, () => Generator<Event<T[number], any>>>>(record);
		};

		return new Task<Error, Record<number, () => Generator<Event<T[number], any>>>>(resolver);
	}

	produceEventsForTypesAsync<T extends string[]>(
    	typesAggregateIdsMinVersions: Array<[T[keyof T], Optional<string>, Optional<number>]>,
    	fromDate: Optional<Date>,
	): AsyncTask<Error, Record<number, () => AsyncGenerator<Event<T[number], any>>>> {
		const resolver = async () => {
			// We need an alias for this because we can't use arrow-functions for generators
			// eslint-disable-next-line @typescript-eslint/no-this-alias, unicorn/no-this-assignment
			const newThis = this;
			const record: Record<string, () => AsyncGenerator<Event<any, any>>> = {};
			for (const [typeName, aggregateId, fromVersion] of typesAggregateIdsMinVersions) {
				const generator = async function * () {
					const list: Array<Event<any, any>> = newThis.allEventsByType[typeName as string] ?? [];
					const filteredByDate: Array<Event<any, any>> = fromDate.match(
						date => list.filter(element => element.metadata.timestampMs >= date.getTime()),
						() => list,
					);
					const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome())
						? newThis.filterByVersion(
							fromVersion,
							newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(element => isDomainEvent(element)) as Array<DomainEvent<any, any, any>>)),
						)
						: filteredByDate;

					const sorted = filteredByDomainEventCriteria.sort(defaultEventComparator.compare);
					for (const evt of sorted) {
						yield evt;
					}
				};

				record[typeName as string] = generator;
			}

			return new Right<Error, Record<number, () => AsyncGenerator<Event<T[number], any>>>>(record);
		};

		return new AsyncTask<Error, Record<number, () => AsyncGenerator<Event<T[number], any>>>>(resolver);
	}

	protected filterByAggregateId<T extends string>(
    	aggregateId: Optional<string>,
    	list: Array<DomainEvent<T, any, any>>,
	): Array<DomainEvent<T, any, any>> {
		return aggregateId.match(
			id => list.filter(element => element.getAggregateId() === id),
			() => list,
		);
	}

	protected filterByDate<T extends string>(
    	fromDate: Optional<Date>,
    	list: Array<Event<T, any>>,
	): Array<Event<T, any>> {
		return fromDate.match(
			date => list.filter(element => element.metadata.timestampMs >= date.getTime()),
			() => list,
		);
	}

	protected filterByVersion<T extends string>(
    	fromVersion: Optional<number>,
    	list: Array<DomainEvent<T, any, any>>,
	): Array<DomainEvent<T, any, any>> {
		return fromVersion.match(
			version => list.filter(element => !isBasicDomainEvent(element) || element.newAggregateVersion >= version),
			() => list,
		);
	}
}
