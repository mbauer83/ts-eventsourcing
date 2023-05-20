import { Optional } from "@mbauer83/ts-functional/src/Optional";
import {Event} from "./Event";
import { Projection } from "./Projection";

export interface Projector<T> {
    eventTypes: string[]
    /**
    * This method can be implemented to collect events in some internal or external storage and project to a new T
    * when the event given to `project` makes the collection fulfill some condition which allows construction of a new T
    **/
    project(e: Event<any, any>): Promise<Optional<Projection<T>>>
}