export interface Orderable<T> {
	compare(t1: T, t2: T): number;
}
