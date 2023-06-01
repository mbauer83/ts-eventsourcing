export interface Projection<T> {
	name: string;
	id: string;
	lastModifiedTimestampMS: number;
	content: T;
}

export class GenericProjection<T> implements Projection<T> {
	constructor(
		public readonly name: string,
		public readonly id: string,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		public readonly lastModifiedTimestampMS: number,
		public readonly content: T,
	) {}
}
