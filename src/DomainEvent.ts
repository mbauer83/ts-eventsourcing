import {type Aggregate, type AggregateType} from './Aggregate.js';
import {defaultEventComparator, type Event, type EventMetadata} from './Event.js';

export type BaseDomainEventPayload<T extends AggregateType> = {aggregateTypeName: T; aggregateId: string};

export interface DomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends BaseDomainEventPayload<AggregateTypeName>,
> extends Event<AggregateTypeName, EventMessageType> {
	getType(): AggregateTypeName;
	isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any>;
	getAggregateId(): string;
	getAggregateVersion(): number;
}

export type InitializingDomainEventPayload<T extends AggregateType, AggregateStateType> = BaseDomainEventPayload<T> & {snapshot: Aggregate<T, AggregateStateType>};

export interface InitializingDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends InitializingDomainEventPayload<AggregateTypeName, AggregateStateType>,
> extends DomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
	getSnapshot(): Aggregate<AggregateTypeName, AggregateStateType>;
}

export type BasicDomainEventPayload<T extends AggregateType> = BaseDomainEventPayload<T> & {newAggregateVersion: number};

export interface BasicDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends BasicDomainEventPayload<AggregateTypeName>,
> extends DomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
	apply(s: AggregateStateType): AggregateStateType;
}

export type SnapshotDomainEventPayload<T extends AggregateType, AggregateStateType> = BasicDomainEventPayload<T> & {snapshot: Aggregate<T, AggregateStateType>};

export interface SnapshotDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends SnapshotDomainEventPayload<AggregateTypeName, AggregateStateType>,
> extends BasicDomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
	getSnapshot(): Aggregate<AggregateTypeName, AggregateStateType>;
}

export function isDomainEvent<T extends string, S>(event: Event<T, any>): event is DomainEvent<T, S, any> {
	return 'isInitial' in event;
}

export function isInitializingDomainEvent<T extends string, S>(domainEvent: DomainEvent<T, any, any>): domainEvent is InitializingDomainEvent<T, S, any> {
	return domainEvent.isInitial();
}

export function isBasicDomainEvent<T extends string, S>(domainEvent: DomainEvent<T, any, any>): domainEvent is BasicDomainEvent<T, S, any> {
	return 'getAggregateVersion' in domainEvent;
}

export function isSnapshotDomainEvent<T extends string, S>(domainEvent: DomainEvent<T, any, any>): domainEvent is SnapshotDomainEvent<T, S, any> {
	return !domainEvent.isInitial() && 'getSnapshot' in domainEvent;
}

export class GenericInitializingDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	T extends InitializingDomainEventPayload<AggregateTypeName, AggregateStateType>,
> implements InitializingDomainEvent<AggregateTypeName, AggregateStateType, T> {
	constructor(
		public readonly id: string,
		public readonly payload: T,
		public readonly metadata: EventMetadata,
	) {}

	getType(): AggregateTypeName {
		return this.payload.aggregateTypeName;
	}

	getPayload(): T {
		return this.payload;
	}

	getMetadata(): EventMetadata {
		return this.metadata;
	}

	compare(t1: Event<AggregateTypeName, T>, t2: Event<AggregateTypeName, T>): -1 | 0 | 1 {
		return defaultEventComparator.compare(t1, t2);
	}

	isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any> {
		return true;
	}

	getAggregateId(): string {
		return this.payload.snapshot.id;
	}

	getAggregateVersion(): number {
		return this.payload.snapshot.version;
	}

	getSnapshot(): Aggregate<AggregateTypeName, AggregateStateType> {
		return this.payload.snapshot;
	}
}

export class GenericBasicDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	T extends BasicDomainEventPayload<AggregateTypeName>,
> implements BasicDomainEvent<AggregateTypeName, AggregateStateType, T> {
	constructor(
		public readonly id: string,
		public readonly payload: T,
		public readonly metadata: EventMetadata,
		private readonly applicator: (s: AggregateStateType) => AggregateStateType,
	) {}

	getType(): AggregateTypeName {
		return this.payload.aggregateTypeName;
	}

	getPayload(): T {
		return this.payload;
	}

	getMetadata(): EventMetadata {
		return this.metadata;
	}

	isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any> {
		return false;
	}

	compare(t1: Event<AggregateType, T>, t2: Event<AggregateType, T>): -1 | 0 | 1 {
		return defaultEventComparator.compare(t1, t2);
	}

	getAggregateId(): string {
		return this.payload.aggregateId;
	}

	getAggregateVersion(): number {
		return this.payload.newAggregateVersion;
	}

	apply(s: AggregateStateType): AggregateStateType {
		return this.applicator(s);
	}
}
