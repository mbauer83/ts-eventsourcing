import {type Aggregate, type AggregateType} from './Aggregate.js';
import {defaultEventComparator, type Event, type EventMetadata} from './Event.js';

export type BaseDomainEventPayload<T extends AggregateType> = {aggregateTypeName: T; aggregateId: string};

export interface DomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends BaseDomainEventPayload<AggregateTypeName>,
> extends Event<AggregateTypeName, EventMessageType> {
	readonly type: AggregateTypeName;
	isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any>;
	getAggregateId(): string;
}

export type InitializingDomainEventPayload<T extends AggregateType, AggregateStateType> = BaseDomainEventPayload<T> & {snapshot: Aggregate<T, AggregateStateType>};

export interface InitializingDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends InitializingDomainEventPayload<AggregateTypeName, AggregateStateType>,
> extends DomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
	readonly snapshot: Aggregate<AggregateTypeName, AggregateStateType>;
}

export type BasicDomainEventPayload<T extends AggregateType> = BaseDomainEventPayload<T> & {newAggregateVersion: number};

export interface BasicDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends BasicDomainEventPayload<AggregateTypeName>,
> extends DomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
	readonly newAggregateVersion: number;
	apply(s: AggregateStateType): AggregateStateType;
}

export type SnapshotDomainEventPayload<T extends AggregateType, AggregateStateType> = BasicDomainEventPayload<T> & {snapshot: Aggregate<T, AggregateStateType>};

export interface SnapshotDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	EventMessageType extends SnapshotDomainEventPayload<AggregateTypeName, AggregateStateType>,
> extends BasicDomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
	readonly snapshot: Aggregate<AggregateTypeName, AggregateStateType>;
}

export function isDomainEvent<T extends string, S>(event: Event<T, any>): event is DomainEvent<T, S, any> {
	const hasProp = Object.prototype.hasOwnProperty;
	const isDomainEvent = hasProp.call(event, 'isInitial');
	return isDomainEvent;
}

export function isInitializingDomainEvent<T extends string, S>(domainEvent: DomainEvent<T, any, any>): domainEvent is InitializingDomainEvent<T, S, any> {
	return domainEvent.isInitial();
}

export function isBasicDomainEvent<T extends string, S>(domainEvent: DomainEvent<T, any, any>): domainEvent is BasicDomainEvent<T, S, any> {
	const hasProp = Object.prototype.hasOwnProperty;
	const isBasicDomainEvent = hasProp.call(domainEvent, 'newAggregateVersion');
	return isBasicDomainEvent;
}

export function isSnapshotDomainEvent<T extends string, S>(domainEvent: DomainEvent<T, any, any>): domainEvent is SnapshotDomainEvent<T, S, any> {
	const hasProp = Object.prototype.hasOwnProperty;
	const hasSnapshot = hasProp.call(domainEvent, 'snapshot');
	const isSnapshotDomainEvent = !domainEvent.isInitial() && hasSnapshot;
	return isSnapshotDomainEvent;
}

export class GenericInitializingDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	T extends InitializingDomainEventPayload<AggregateTypeName, AggregateStateType>,
> implements InitializingDomainEvent<AggregateTypeName, AggregateStateType, T> {
	public readonly type: AggregateTypeName;
	public readonly aggregateId: string;
	public readonly snapshot: Aggregate<AggregateTypeName, AggregateStateType>;
	public readonly metadata: EventMetadata;
	public readonly content: T;

	constructor(
		public readonly id: string,
		payload: T,
		metadata: EventMetadata,
	) {
		this.type = payload.aggregateTypeName;
		this.snapshot = payload.snapshot;
		this.aggregateId = payload.aggregateId;
		this.metadata = metadata;
		this.content = payload;
	}

	compare(t1: Event<AggregateTypeName, T>, t2: Event<AggregateTypeName, T>): -1 | 0 | 1 {
		return defaultEventComparator.compare(t1, t2);
	}

	isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any> {
		return true;
	}

	getAggregateId(): string {
		return this.snapshot.id;
	}
}

export class GenericBasicDomainEvent<
	AggregateTypeName extends AggregateType,
	AggregateStateType,
	T extends BasicDomainEventPayload<AggregateTypeName>,
> implements BasicDomainEvent<AggregateTypeName, AggregateStateType, T> {
	public readonly aggregateId: string;
	public readonly type: AggregateTypeName;
	public readonly metadata: EventMetadata;
	public readonly newAggregateVersion: number;
	public readonly content: T;
	protected readonly applicator: (s: AggregateStateType) => AggregateStateType;

	constructor(
		public readonly id: string,
		payload: T,
		metadata: EventMetadata,
		applicator: (s: AggregateStateType) => AggregateStateType,
	) {
		this.type = payload.aggregateTypeName;
		this.metadata = metadata;
		this.newAggregateVersion = payload.newAggregateVersion;
		this.aggregateId = payload.aggregateId;
		this.content = payload;
		this.applicator = applicator;
	}

	isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any> {
		return false;
	}

	compare(t1: Event<AggregateType, T>, t2: Event<AggregateType, T>): -1 | 0 | 1 {
		return defaultEventComparator.compare(t1, t2);
	}

	getAggregateId(): string {
		return this.aggregateId;
	}

	apply(s: AggregateStateType): AggregateStateType {
		return this.applicator(s);
	}
}
