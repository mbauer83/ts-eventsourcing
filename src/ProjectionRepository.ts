import {Task} from '@mbauer83/ts-functional/src/Task';
import {AsyncTask} from '@mbauer83/ts-functional/src/AsyncTask';
import {type Either, Left, Right} from '@mbauer83/ts-functional/src/Either';
import {type Projection} from './Projection';

export interface ProjectionRepository {
	getProjection<T>(name: string, id: string): Task<Error, Projection<T>>;
	getAllProjections<T>(name: string): Task<Error, Array<Projection<T>>>;
	storeProjections<T>(...projections: Array<Projection<T>>): Task<Error, void>;
}

export interface AsyncProjectionRepository {
	getProjection<T>(name: string, id: string): AsyncTask<Error, Projection<T>>;
	getAllProjections<T>(name: string): AsyncTask<Error, Array<Projection<T>>>;
	storeProjections<T>(...projections: Array<Projection<T>>): AsyncTask<Error, void>;
}

export class InMemoryProjectionRepository implements ProjectionRepository {
	private readonly projectionsByNameAndId: Record<string, Record<string, Projection<any>>> = {};

	getProjection<T>(name: string, id: string): Task<Error, Projection<T>> {
		return new Task<Error, Projection<T>>((_: any): Either<Error, Projection<T>> => {
			const byName = this.projectionsByNameAndId[name];
			if (!byName) {
				return new Left<Error, Projection<T>>(new Error(`No projections for name [${name}]`));
			}

			const projection = byName[id];
			if (!projection) {
				return new Left<Error, Projection<T>>(new Error(`No projection for name [${name}] and id [${id}]`));
			}

			return new Right<Error, Projection<T>>(projection as Projection<T>);
		});
	}

	getAllProjections<T>(name: string): Task<Error, Array<Projection<T>>> {
		return new Task<Error, Array<Projection<T>>>((_: any): Either<Error, Array<Projection<T>>> => {
			const byName = this.projectionsByNameAndId[name];
			if (!byName) {
				return new Left<Error, Array<Projection<T>>>(new Error(`No projections for name [${name}]`));
			}

			return new Right<Error, Array<Projection<T>>>(Object.values(byName) as Array<Projection<T>>);
		});
	}

	storeProjections<T>(...projections: Array<Projection<T>>): Task<Error, void> {
		return new Task<Error, void>((_: any): Either<Error, void> => {
			for (const projection of projections) {
				const byName = this.projectionsByNameAndId[projection.name] || {};
				byName[projection.id] = projection;
				this.projectionsByNameAndId[projection.name] = byName;
			}

			return new Right<Error, void>(undefined);
		});
	}
}

export class InMemoryAsyncProjectionRepository implements AsyncProjectionRepository {
	private readonly projectionsByNameAndId: Record<string, Record<string, Projection<any>>> = {};

	getProjection<T>(name: string, id: string): AsyncTask<Error, Projection<T>> {
		return new AsyncTask<Error, Projection<T>>(async (_: any): Promise<Either<Error, Projection<T>>> => {
			const byName = this.projectionsByNameAndId[name];
			if (!byName) {
				return new Left<Error, Projection<T>>(new Error(`No projections for name [${name}]`));
			}

			const projection = byName[id];
			if (!projection) {
				return new Left<Error, Projection<T>>(new Error(`No projection for name [${name}] and id [${id}]`));
			}

			return new Right<Error, Projection<T>>(projection as Projection<T>);
		});
	}

	getAllProjections<T>(name: string): AsyncTask<Error, Array<Projection<T>>> {
		return new AsyncTask<Error, Array<Projection<T>>>(async (_: any): Promise<Either<Error, Array<Projection<T>>>> => {
			const byName = this.projectionsByNameAndId[name];
			if (!byName) {
				return new Left<Error, Array<Projection<T>>>(new Error(`No projections for name [${name}]`));
			}

			return new Right<Error, Array<Projection<T>>>(Object.values(byName) as Array<Projection<T>>);
		});
	}

	storeProjections<T>(...projections: Array<Projection<T>>): AsyncTask<Error, void> {
		return new AsyncTask<Error, void>(async (_: any): Promise<Either<Error, void>> => {
			for (const projection of projections) {
				const byName = this.projectionsByNameAndId[projection.name] || {};
				byName[projection.id] = projection;
				this.projectionsByNameAndId[projection.name] = byName;
			}

			return new Right<Error, void>(undefined);
		});
	}
}
