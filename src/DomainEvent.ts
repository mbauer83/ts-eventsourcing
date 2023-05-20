import {Aggregate, AggregateType} from "./Aggregate";
import {BaseJSONSerializable} from "./Serializable";
import {DefaultEventComparator, Event, EventMetadata} from "./Event";

export type BaseDomainEventPayload<T extends AggregateType> = { aggregateTypeName: T, aggregateId: string };

export interface DomainEvent<
    AggregateTypeName extends AggregateType,
    AggregateStateType,
    EventMessageType extends BaseDomainEventPayload<AggregateTypeName>
> extends Event<AggregateTypeName, EventMessageType> {
    readonly type: AggregateTypeName;
    isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any>;
    getAggregateId(): string;
}

export type InitializingDomainEventPayload<T extends AggregateType, AggregateStateType> = BaseDomainEventPayload<T> & { snapshot: Aggregate<T, AggregateStateType> };

export interface InitializingDomainEvent<
    AggregateTypeName extends AggregateType,
    AggregateStateType,
    EventMessageType  extends InitializingDomainEventPayload<AggregateTypeName, AggregateStateType>
> extends DomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
    readonly snapshot: Aggregate<AggregateTypeName, AggregateStateType>;
}

export type BasicDomainEventPayload<T extends AggregateType> = BaseDomainEventPayload<T> & { newAggregateVersion: number };

export interface BasicDomainEvent<
    AggregateTypeName extends AggregateType,
    AggregateStateType,
    EventMessageType extends BasicDomainEventPayload<AggregateTypeName>
> extends DomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
    apply(s: AggregateStateType): AggregateStateType;
    readonly newAggregateVersion: number;
}

export type SnapshotDomainEventPayload<T extends AggregateType, AggregateStateType> = BasicDomainEventPayload<T> & { snapshot: Aggregate<T, AggregateStateType> };

export interface SnapshotDomainEvent<
    AggregateTypeName extends AggregateType,
    AggregateStateType,
    EventMessageType extends SnapshotDomainEventPayload<AggregateTypeName, AggregateStateType>
> extends BasicDomainEvent<AggregateTypeName, AggregateStateType, EventMessageType> {
    readonly snapshot: Aggregate<AggregateTypeName, AggregateStateType>;
}

export function isDomainEvent<T extends string, S>(e: Event<T, any>): e is DomainEvent<T, S, any> {
    return e.hasOwnProperty('isInitial');
}

export function isInitializingDomainEvent<T extends string, S>(e: DomainEvent<T, any, any>): e is InitializingDomainEvent<T, S, any> {
    return e.isInitial();
}

export function isBasicDomainEvent<T extends string, S>(e: DomainEvent<T, any, any>): e is BasicDomainEvent<T, S, any> {
    return e.hasOwnProperty('newAggregateVersion');
}

export function isSnapshotDomainEvent<T extends string, S>(e: DomainEvent<T, any, any>): e is SnapshotDomainEvent<T, S, any> {
    return !e.isInitial() && e.hasOwnProperty('snapshot');
}


export class GenericInitializingDomainEvent<
    AggregateTypeName extends AggregateType,
    AggregateStateType,
    T extends InitializingDomainEventPayload<AggregateTypeName, AggregateStateType>
> extends BaseJSONSerializable implements InitializingDomainEvent<AggregateTypeName, AggregateStateType, T> {
    public readonly id: string;
    public readonly type: AggregateTypeName;
    public readonly aggregateId: string;
    public readonly snapshot: Aggregate<AggregateTypeName, AggregateStateType>;
    public readonly metadata: EventMetadata;
    public readonly content: T;

    isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any> {
        return true;
    }

    constructor(
        id: string,
        payload: T,
        metadata: EventMetadata
    ) {
        super();
        this.id = id;
        this.type = payload.aggregateTypeName;
        this.snapshot = payload.snapshot;
        this.aggregateId = payload.aggregateId;
        this.metadata = metadata;
        this.content = payload;
    }

    compare(t1: Event<AggregateType, T>, t2: Event<AggregateType, T>): number {
        return DefaultEventComparator(t1, t2);
    }

    getAggregateId(): string {
        return this.snapshot.id;
    }
}


export class GenericBasicDomainEvent<
    AggregateTypeName extends AggregateType,
    AggregateStateType,
    T extends BasicDomainEventPayload<AggregateTypeName>
> extends BaseJSONSerializable implements BasicDomainEvent<AggregateTypeName, AggregateStateType, T> {
    public readonly id: string;
    public readonly aggregateId: string;
    public readonly type: AggregateTypeName;
    public readonly metadata: EventMetadata;
    public readonly newAggregateVersion: number;
    protected readonly applicator: (s: AggregateStateType) => AggregateStateType;
    public readonly content: T;

    isInitial(): this is InitializingDomainEvent<AggregateTypeName, AggregateStateType, any> {
        return false;
    }

    constructor(
        id: string,
        payload: T,
        metadata: EventMetadata,
        applicator: (s: AggregateStateType) => AggregateStateType
    ) {
        super();
        this.id = id;
        this.type = payload.aggregateTypeName;
        this.metadata = metadata;
        this.newAggregateVersion = payload.newAggregateVersion;
        this.aggregateId = payload.aggregateId;
        this.content = payload;
        this.applicator = applicator;
    }

    compare(t1: Event<AggregateType, T>, t2: Event<AggregateType, T>): number {
        return DefaultEventComparator(t1, t2);
    }

    getAggregateId(): string {
        return this.aggregateId;
    }

    apply(s: AggregateStateType): AggregateStateType {
        return this.applicator(s);
    }
}