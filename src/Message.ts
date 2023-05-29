export interface Message<T> {
	readonly id: string;
	readonly metadata: Record<string, unknown>;
	readonly payload: T;
}
