export interface Projection<T> {
	name: string;
	id: string;
	lastModifiedTimestampMS: number;
	content: T;
}
