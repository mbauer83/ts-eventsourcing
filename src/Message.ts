import {Serializable, SerializableObject} from "./Serializable";

export interface Message<T> {
    readonly id: string;
    readonly metadata: {};
    readonly content: T;
}