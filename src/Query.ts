import {type Path} from '@mbauer83/ts-utils/src/objectPath/Path.js';
import {type PropertyType} from '@mbauer83/ts-utils/src/objectPath/PropertyType.js';
import {Lens} from '@mbauer83/ts-functional/src/Lens.js';
import {type Either, Right} from '@mbauer83/ts-functional/src/Either.js';
import {BaseAggregate, type Aggregate} from './Aggregate.js';
import {type Projection} from './Projection.js';
import {type BaseCommandPayload, type Command} from './Command.js';
import {type BasicDomainEvent} from './DomainEvent.js';

export type QueryMetadata = Record<string, unknown> & {
	timestampMs: number;
	issuer: string;
};

export interface Query<U extends string, T extends (Aggregate<U, unknown> | Projection<U>)> {
	targetType: U;
	targetId: string;
	metadata: QueryMetadata;
	extractionPathsWithLabels?: Array<[Path<T>, string]>;
}

type QueryResultValueType<T, A extends (Array<[Path<T>, string]> | undefined)>
	= A extends undefined ?
		T :
		A extends Array<[Path<T>, string]> ?
			PropertyType<T, A[number][0]> :
			never;

export const extractForQuery
	= <U extends string, T extends (Aggregate<U, unknown> | Projection<U>), Q extends Query<U, T>>(
		query: Q,
		target: T,
	  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
	  ): {[key: string]: QueryResultValueType<T, Q['extractionPathsWithLabels']>} => {
	 	const {extractionPathsWithLabels} = query;
	 	if (extractionPathsWithLabels === undefined) {
	 		// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
	 		return target as any as {[key: string]: QueryResultValueType<T, Q['extractionPathsWithLabels']>};
	 	}

		// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
		const result: {[key: string]: QueryResultValueType<T, Q['extractionPathsWithLabels']>} = {} satisfies {[key: string]: QueryResultValueType<T, Q['extractionPathsWithLabels']>};
	 	for (const [path, label] of extractionPathsWithLabels) {
	 		const currLens = Lens.build<T>()(path);
			result[label] = currLens.get(target) as QueryResultValueType<T, Q['extractionPathsWithLabels']>;
	 	}

		return result;
	};

/** EXAMPLE

class B {
	constructor(
		public readonly c: string,
		public readonly d: number,
	) {}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
class AState {
	constructor(
		public readonly a: Date,
		public readonly b: B,
	) {}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
type AType = 'A';

class A extends BaseAggregate<AType, AState> implements Aggregate<AType, AState> {
	constructor(
		public readonly id: string,
		public readonly state: AState,
		public readonly version: number = 0,
	) {
		super('A', id, state, version);
	}

	get<K extends keyof AState>(parameterName: K): AState[K] {
		return this.state[parameterName];
	}

	protected withState(s: AState, newVersion: number): Aggregate<'A', AState> {
		return new A(this.id, s, newVersion);
	}

	protected eventsForCommand<T extends BaseCommandPayload<'A'>>(command: Command<'A', AState, T>): Either<Error, Array<BasicDomainEvent<'A', AState, any>>> {
		return new Right<Error, Array<BasicDomainEvent<'A', AState, any>>>([]);
	}
}

const someB = new B('hello', 47);
const someA = new A('someId', new AState(new Date(), someB));
const agg: Aggregate<AType, unknown> = someA;
// eslint-disable-next-line @typescript-eslint/naming-convention
const queryForCandDinBinAState: Query<AType, A> = {
	targetType: 'A',
	targetId: 'someId',
	metadata: {
		timestampMs: Date.now(),
		issuer: 'someIssuer',
	},
	extractionPathsWithLabels: [
		['state.b.c' as Path<A>, 'c'],
		['state.b.d' as Path<A>, 'd'],
	],
};

const extractedValue = extractForQuery(queryForCandDinBinAState, someA);
console.log(extractedValue);
 **/

