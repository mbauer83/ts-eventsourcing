import {Message} from "./Message";
import {Orderable} from "./Orderable";

export type EventMetadata = Record<string, any> & { timestampMs: number, issuer: string };

export interface Event<Type extends string, MessageContent> extends Message<MessageContent>, Orderable<Event<Type, MessageContent>> {
    readonly metadata: EventMetadata;
    readonly type: Type;
}

export const DefaultEventComparator = (e1: Event<any, any>, e2: Event<any, any>) => {
    return e1.metadata.timestampMs < e2.metadata.timestampMs ?
        -1 :
        e1.metadata.timestampMs === e2.metadata.timestampMs ?
            0 :
            1;
}