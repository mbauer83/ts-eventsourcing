import {DefaultEventComparator, Event} from "./Event";
import {BasicDomainEvent, DomainEvent, InitializingDomainEvent, SnapshotDomainEvent} from "./DomainEvent";
import { Optional } from "@mbauer83/ts-functional/src/Optional";

export interface EventStorage {
    produceEvents<T extends string>(type: T, aggregateId: Optional<string>, fromDate: Optional<Date>, fromVersion: Optional<number>): Generator<Event<T, any>>
    produceEventsAsync<T extends string>(type: T, aggregateId: Optional<string>, fromDate: Optional<Date>, fromVersion: Optional<number>): AsyncGenerator<Event<T, any>>
    produceEventsForTypes<T extends string[]>(typesAggregateIdsMinVersions: [T[keyof T], Optional<string>, Optional<number>][], fromDate: Optional<Date>): { [I in keyof T]: Generator<Event<T[I], any>> }
    produceEventsForTypesAsync<T extends string[]>(typesAggregateIdsMinVersions: [T[keyof T], Optional<string>, Optional<number>][], fromDate: Optional<Date>): { [I in keyof T]: AsyncGenerator<Event<T[I], any>> }
    storeEvents(...events: Event<any, any>[]): Promise<void>
}

export class InMemoryDomainEventStorage implements EventStorage {

    private allEventsByType: Record<string, Event<any, any>[]> = {};
    private basicEventsByTypeAndId: Record<string, Record<string, BasicDomainEvent<any, any, any>[]>> = {};
    private snapshotEventsByTypeAndId: Record<string, Record<string, SnapshotDomainEvent<any, any, any>[]>> = {};
    private initialEventsByTypeAndId: Record<string, Record<string, InitializingDomainEvent<any, any, any>>> = {};


    async storeEvents(...events: DomainEvent<any, any, any>[]): Promise<void> {
        for (const evt of events) {
            const list = this.allEventsByType[evt.type] ?? [];
            list.push(evt);
            this.allEventsByType[evt.type] = list;
            if (evt.isInitial()) {
                const aggregateId = evt.getAggregateId();
                if (this.initialEventsByTypeAndId.hasOwnProperty(evt.type)) {
                    const byAggregateId = this.initialEventsByTypeAndId[evt.type];
                    if (byAggregateId.hasOwnProperty(aggregateId)) {
                        throw new Error("Initializing event already exists for type [" + evt.type + "] and id [" + aggregateId + "].");
                    }
                    byAggregateId[aggregateId] = evt;
                    this.initialEventsByTypeAndId[evt.type] = byAggregateId;
                }
                continue;
            } 
            if (evt.hasOwnProperty('snapshot')) {
                const aggregate = (evt as SnapshotDomainEvent<any, any, any>).snapshot;
                const aggregateId = aggregate.id;
                const byAggregateId = this.snapshotEventsByTypeAndId[evt.type] ?? {}
                const listForAggregateId = byAggregateId[aggregateId] ?? []
                listForAggregateId.push(evt as SnapshotDomainEvent<any, any, any>);
                byAggregateId[aggregateId] = listForAggregateId;
                this.snapshotEventsByTypeAndId[evt.type] = byAggregateId;
                continue;
            }
            const aggregate = (evt as SnapshotDomainEvent<any, any, any>).snapshot;
            const aggregateId = aggregate.id;
            const byAggregateId = this.basicEventsByTypeAndId[evt.type] ?? {}
            const listForAggregateId: BasicDomainEvent<any, any, any>[] = byAggregateId[aggregateId] ?? []
            listForAggregateId.push(evt as SnapshotDomainEvent<any, any, any>);
            byAggregateId[aggregateId] = listForAggregateId;
            this.basicEventsByTypeAndId[evt.type] = byAggregateId;
        }
    }

    protected isDomainEvent<T extends string>(e: Event<T, any>): e is DomainEvent<T, any, any> {
        return e.hasOwnProperty('isInitial');
    }

    protected isBasicDomainEvent<T extends string>(e: Event<T, any>): e is BasicDomainEvent<T, any, any> {
        return e.hasOwnProperty('newAggregateVersion');
    }

    protected filterByAggregateId<T extends string>(aggregateId: Optional<string>, list: DomainEvent<T, any, any>[]): DomainEvent<T, any, any>[] {
        return aggregateId.match(
            (id) => list.filter(e => e.getAggregateId() === id),
            () => list
        );
    }

    protected filterByDate<T extends string>(fromDate: Optional<Date>, list: Event<T, any>[]): Event<T, any>[] {
        return fromDate.match(
            (date) => list.filter(e => e.metadata.timestampMs >= date.getTime()),
            () => list
        );
    }

    protected filterByVersion<T extends string>(fromVersion: Optional<number>, list: DomainEvent<T, any, any>[]): DomainEvent<T, any, any>[] {
        return fromVersion.match(
            (version) => list.filter(e => !this.isBasicDomainEvent(e) || e.newAggregateVersion >= version),
            () => list
        );
    }


    produceEvents<T extends string>(type: T, aggregateId: Optional<string>, fromDate: Optional<Date>, fromVersion: Optional<number>): Generator<Event<T, any>, any, unknown> {
        const newThis = this;
        const generator = function* () {
            const list: Event<T, any>[] = newThis.allEventsByType[type] ?? [];
            const filteredByDate: Event<T, any>[] = fromDate.match(
                (date) => list.filter(e => e.metadata.timestampMs >= date.getTime()),
                () => list
            );
            const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome()) ?
                newThis.filterByVersion(
                    fromVersion, 
                    newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(e => newThis.isDomainEvent(e)) as DomainEvent<T, any, any>[]))
                ) :
                filteredByDate;
         
            const sorted = filteredByDomainEventCriteria.sort(DefaultEventComparator)
            for (const evt of sorted) {
                yield evt;
            }
        }
        return generator();
    }

    produceEventsAsync<T extends string>(type: T, aggregateId: Optional<string>, fromDate: Optional<Date>, fromVersion: Optional<number>): AsyncGenerator<Event<T, any>, any, unknown> {
        const newThis = this;
        const generator = async function* () {
            const list: Event<T, any>[] = newThis.allEventsByType[type] ?? [];
            const filteredByDate: Event<T, any>[] = fromDate.match(
                (date) => list.filter(e => e.metadata.timestampMs >= date.getTime()),
                () => list
            );
            const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome()) ?
                newThis.filterByVersion(
                    fromVersion, 
                    newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(e => newThis.isDomainEvent(e)) as DomainEvent<T, any, any>[]))
                ) :
                filteredByDate;
         
            const sorted = filteredByDomainEventCriteria.sort(DefaultEventComparator)
            for (const evt of sorted) {
                yield evt;
            }
        }
        return generator();
    }

    produceEventsForTypes<T extends string[]>(typesAggregateIdsMinVersions: [T[keyof T], Optional<string>, Optional<number>][], fromDate: Optional<Date>): { [I in keyof T]: Generator<Event<T[I], any>, any, unknown>; } {
        const newThis = this;
        const record: Record<string, Generator<Event<any, any>, any, unknown>> = {};
        for (const [typeName, aggregateId, fromVersion] of typesAggregateIdsMinVersions) {
            const generator = function* () {
                const list: Event<any, any>[] = newThis.allEventsByType[typeName as string] ?? [];
                const filteredByDate: Event<any, any>[] = fromDate.match(
                    (date) => list.filter(e => e.metadata.timestampMs >= date.getTime()),
                    () => list
                );
                const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome()) ?
                    newThis.filterByVersion(
                        fromVersion, 
                        newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(e => newThis.isDomainEvent(e)) as DomainEvent<any, any, any>[]))
                    ) :
                    filteredByDate;
             
                const sorted = filteredByDomainEventCriteria.sort(DefaultEventComparator)
                for (const evt of sorted) {
                    yield evt;
                }
            }
            record[typeName as string] = generator();
        }
        return record as { [I in keyof T]: Generator<Event<T[I], any>, any, unknown>; };
    }

    produceEventsForTypesAsync<T extends string[]>(typesAggregateIdsMinVersions: [T[keyof T], Optional<string>, Optional<number>][], fromDate: Optional<Date>): { [I in keyof T]: AsyncGenerator<Event<T[I], any>, any, unknown>; } {
        const newThis = this;
        const record = {};
        for (const [typeName, aggregateId, fromVersion] of typesAggregateIdsMinVersions) {
            const generator = async function* () {
                const list: Event<any, any>[] = newThis.allEventsByType[typeName as string] ?? [];
                const filteredByDate: Event<any, any>[] = fromDate.match(
                    (date) => list.filter(e => e.metadata.timestampMs >= date.getTime()),
                    () => list
                );
                const filteredByDomainEventCriteria = (aggregateId.isSome() || fromVersion.isSome()) ?
                    newThis.filterByVersion(
                        fromVersion, 
                        newThis.filterByAggregateId(aggregateId, (filteredByDate.filter(e => newThis.isDomainEvent(e)) as DomainEvent<any, any, any>[]))
                    ) :
                    filteredByDate;
             
                const sorted = filteredByDomainEventCriteria.sort(DefaultEventComparator)
                for (const evt of sorted) {
                    yield evt;
                }
            }
            record[typeName as string] = generator();
        }
        return record as { [I in keyof T]: AsyncGenerator<Event<T[I], any>, any, unknown>; };
    }

}