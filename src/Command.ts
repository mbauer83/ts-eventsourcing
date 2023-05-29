import {type Message} from './Message.js';
import {type AggregateType} from './Aggregate.js';
import {type EventMetadata} from './Event.js';

export type CommandMetadata = {timestampMs: number; issuer: string};

export type BaseCommandPayload<T extends AggregateType> = {aggregateTypeName: T; aggregateId: string};

export interface Command<AggregateTypeName extends AggregateType, AggregateStateType, T extends BaseCommandPayload<AggregateType>> extends Message<T> {
	getAggregateTypeName(): AggregateTypeName;
	getAggregateId(): string;
	getMetadata(): CommandMetadata;
	getPayload(): T;
}

export type InitializationCommandPayload<T extends AggregateType, AggregateStateType> = BaseCommandPayload<T> & {state: AggregateStateType};

export interface InitializationCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends InitializationCommandPayload<AggregateTypeName, AggregateStateType>> extends Command<AggregateTypeName, AggregateStateType, T> {
	getState(): AggregateStateType;
}

export type BasicCommandPayload<T extends AggregateType> = BaseCommandPayload<T> & {appliesToVersion: number};

export interface BasicCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends BasicCommandPayload<AggregateTypeName>> extends Command<AggregateTypeName, AggregateStateType, T> {
	appliesToVersion(): number;
}

export function isInitializationCommand<AggregateTypeName extends AggregateType, AggregateStateType>(command: Command<AggregateTypeName, AggregateStateType, any>): command is InitializationCommand<AggregateTypeName, AggregateStateType, any> {
	return 'state' in command;
}

export function isBasicCommand<AggregateTypeName extends AggregateType, AggregateStateType>(command: Command<AggregateTypeName, AggregateStateType, any>): command is BasicCommand<AggregateTypeName, AggregateStateType, any> {
	return 'appliesToVersion' in command;
}

export class GenericInitializationCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends InitializationCommandPayload<AggregateTypeName, AggregateStateType>> implements InitializationCommand<AggregateTypeName, AggregateStateType, T> {
	public readonly metadata: CommandMetadata;

	constructor(
		public readonly id: string,
		public readonly payload: T,
		createdAt: Date,
		issuer: string,
	) {
		this.metadata = {timestampMs: createdAt.getTime(), issuer};
		this.payload = payload;
	}

	getAggregateTypeName(): AggregateTypeName {
		return this.payload.aggregateTypeName;
	}

	getAggregateId(): string {
		return this.payload.aggregateId;
	}

	getMetadata(): CommandMetadata {
		return this.metadata;
	}

	getPayload(): T {
		return this.payload;
	}

	getState(): AggregateStateType {
		return this.payload.state;
	}
}

export class GenericBasicCommand<AggregateTypeName extends AggregateType, AggregateStateType, T extends BasicCommandPayload<AggregateTypeName>> implements BasicCommand<AggregateTypeName, AggregateStateType, T> {
	readonly metadata: EventMetadata;

	constructor(
		public readonly id: string,
		public readonly payload: T,
		createdAt: Date,
		issuer: string,
	) {
		this.metadata = {timestampMs: createdAt.getTime(), issuer};
		this.payload = payload;
	}

	getAggregateTypeName(): AggregateTypeName {
		return this.payload.aggregateTypeName;
	}

	getAggregateId(): string {
		return this.payload.aggregateId;
	}

	getMetadata(): CommandMetadata {
		return this.metadata;
	}

	getPayload(): T {
		return this.payload;
	}

	appliesToVersion(): number {
		return this.payload.appliesToVersion;
	}
}

export class CommandDoesNotApplyToAggregateVersionError extends Error {
	constructor(aggregateType: AggregateType, aggregateId: string, commandAppliesToVersion: number, aggregateVersion: number) {
		super(`Command for aggregate type [${aggregateType}] and id [${aggregateId}] applies to version [${commandAppliesToVersion}] - aggregate has version [${aggregateVersion}].`);
	}
}

export class CommandNotHandledError extends Error {
	constructor(commandType: string, aggregateType: AggregateType) {
		super(`Command of type [${commandType}] is not handled by aggregate of type [${aggregateType}].`);
	}
}
