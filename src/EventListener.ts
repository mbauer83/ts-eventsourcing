import {Event} from "./Event";
import {Serializable} from "./Serializable";

export interface EventListener<T1 extends string> {
    react(event: Event<T1,any>);
    eventTypes: T1[];
}