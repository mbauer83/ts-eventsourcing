import {SerializableObject} from "./Serializable";
import {Message} from "./Message";
import {AggregateType} from "./Aggregate";
import {EventMetadata} from "./Event";

export type CommandMetadata =  SerializableObject & { timestampMs: number, issuer: string };

export type BaseCommandPayload<T extends AggregateType> = { aggregateTypeName: T, aggregateId: string };

export interface Command<AggregateTypeName extends AggregateType, AggregateStateType, T extends BaseCommandPayload<AggregateType>> extends Message<T> {
    readonly aggregateTypeName: AggregateTypeName;
    readonly aggregateId: string;
    readonly metadata: CommandMetadata;
    readonly payload: T;
}

export type InitializationCommandPayload<T extends AggregateType, AggregateStateType> = BaseCommandPayload<T> & { state: AggregateStateType };

export interface InitializationCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends InitializationCommandPayload<AggregateTypeName, AggregateStateType>> extends Command<AggregateTypeName, AggregateStateType, T> {
    readonly state: AggregateStateType;
}

export type BasicCommandPayload<T extends AggregateType> = BaseCommandPayload<T> & { appliesToVersion: number };

export interface BasicCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends BasicCommandPayload<AggregateTypeName>> extends Command<AggregateTypeName, AggregateStateType, T> {    
    readonly appliesToVersion: number;
}

export function isInitializationCommand<AggregateTypeName extends AggregateType, AggregateStateType>(command: Command<AggregateTypeName, AggregateStateType, any>): command is InitializationCommand<AggregateTypeName, AggregateStateType, any> {
    return 'state' in command;
}

export function isBasicCommand<AggregateTypeName extends AggregateType, AggregateStateType>(command: Command<AggregateTypeName, AggregateStateType, any>): command is BasicCommand<AggregateTypeName, AggregateStateType, any> {
    return 'appliesToVersion' in command;
}

export class GenericInitializationCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends InitializationCommandPayload<AggregateTypeName, AggregateStateType>> implements InitializationCommand<AggregateTypeName, AggregateStateType, T> {

    readonly aggregateTypeName: AggregateTypeName;
    readonly metadata: EventMetadata;
    readonly content: never;
    readonly id: string;
    readonly aggregateId: string;
    readonly state: AggregateStateType;
    readonly payload: T;

    constructor(
        id: string,
        payload: T, 
        createdAt: Date, 
        issuer: string
    ) {
        this.id = id;
        this.aggregateTypeName = payload.aggregateTypeName;
        this.aggregateId = payload.aggregateId;
        this.state = payload.state;
        this.metadata = { timestampMs: createdAt.getTime(), issuer: issuer }
        this.payload = payload;
    }

}

export class GenericBasicCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends BasicCommandPayload<AggregateTypeName>> implements BasicCommand<AggregateTypeName, AggregateStateType, T> {

    readonly aggregateTypeName: AggregateTypeName;
    readonly metadata: EventMetadata;
    readonly content: never;
    readonly id: string;
    readonly aggregateId: string;
    readonly appliesToVersion: number;
    readonly payload: T;
    
    constructor(
        id: string, 
        payload: T,
        createdAt: Date, 
        issuer: string, 
    ) {
        this.id = id;
        this.aggregateTypeName = payload.aggregateTypeName;
        this.aggregateId = payload.aggregateId;
        this.appliesToVersion = payload.appliesToVersion;
        this.metadata = { timestampMs: createdAt.getTime(), issuer: issuer }
        this.payload = payload;
    }

}

export class CommandDoesNotApplyToAggregateVersionError extends Error {
    constructor(aggregateType: AggregateType, aggregateId: string, commandAppliesToVersion: number, aggregateVersion: number) {
        super("Command for aggregate type [" + aggregateType + "] and id [" + aggregateId + "] applies to version [" + commandAppliesToVersion + "] - aggregate has version [" + aggregateVersion + "].");
    }
}