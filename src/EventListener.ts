import {Event} from "./Event";

export interface EventListener<T1 extends string> {
    react(event: Event<T1,any>): Promise<void>;
    eventTypes: T1[];
}