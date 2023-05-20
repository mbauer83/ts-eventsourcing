import { Either, Left, Right } from "@mbauer83/ts-functional/src/Either";
import { BaseCommandPayload, Command } from "./Command";
import {BasicDomainEvent, InitializingDomainEvent, SnapshotDomainEvent} from "./DomainEvent";

export type AggregateType = string;

export interface Aggregate<TypeName extends AggregateType, StateType> {
    readonly type: TypeName;
    readonly id: string;
    readonly state: StateType;
    readonly version: number;
    get<T extends keyof StateType>(idx: T): StateType[T];
    withAppliedEvents(events: BasicDomainEvent<TypeName, StateType, any>[]): Either<Error, Aggregate<TypeName, StateType>>;
    tryApplyCommand(command: Command<TypeName, StateType, any>): Either<Error, Aggregate<TypeName, StateType>>;
}

export abstract class BaseAggregate<Type extends AggregateType, State> {

    public readonly type: Type;

    public readonly id: string;

    public readonly state: State;

    public readonly version: number;

    protected abstract withState(s: State, newVersion: number): Aggregate<Type, State>;

    protected constructor(
        type: Type,
        id: string,
        state: State,
        version: number = 0
    ) {
        this.type = type;
        this.id = id;
        this.state = state;
        this.version = version;
    }

    get<K extends keyof State>(idx: K): State[K] {
        return this.state[idx];
    }

    withAppliedEvents(events: BasicDomainEvent<Type, State, any>[]): Either<Error, Aggregate<Type, State>> {
        let currState = this.state;
        let currVersion = this.version;
        try {
            events.forEach(evt => {            
                currState = evt.apply(currState);
                currVersion = evt.newAggregateVersion;
            });
            return new Right(this.withState(currState, currVersion));
        } catch (e) {
            return new Left(e as Error);
        }
    }

    public abstract tryApplyCommand<T extends BaseCommandPayload<Type>>(command: Command<Type, State, T>): Either<Error, Aggregate<Type, State>>;
}

export class AggregateFactory {
    static createFromInitialEvent<TypeName extends AggregateType, StateType>(
        initialEvent: InitializingDomainEvent<TypeName, StateType, any>,
        ...events: BasicDomainEvent<TypeName, StateType, any>[]
    ): Either<Error, Aggregate<TypeName, StateType>> {
        const initialAggregate = initialEvent.snapshot;
        return initialAggregate.withAppliedEvents(events);
    }

    static createFromSnapshot<TypeName extends AggregateType, StateType>(
        snapshotEvent: SnapshotDomainEvent<TypeName, StateType, any>,
        ...events: BasicDomainEvent<TypeName, StateType, any>[]
    ): Either<Error, Aggregate<TypeName, StateType>> {
        const snapshotAggregate = snapshotEvent.snapshot;
        return snapshotAggregate.withAppliedEvents(events);
    }
}