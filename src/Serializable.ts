import "reflect-metadata";

const SerializedPropertyMetadataKey = Symbol('SerializedProperty');
const ClassDefinesSerializerMetadataKey = Symbol('ClassDefinesSerializer');
const ClassDefinesStringSerializerMetadataKey = Symbol('ClassDefinesStringSerializer');
const ClassDefinesJSONSerializerMetadataKey = Symbol('ClassDefinesJSONSerializer');

export function StringSerializer<T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor implements SerializableClass {
        serialize(): string {
            return serializeToString(this);
        }
    }
}

export function JSONSerializer<T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor implements SerializableClass {
        serialize(): string {
            return serializeToJSON(this);
        }
    }
}

export type MethodSerializableType = { serialize(): string; }

export abstract class BaseJSONSerializable {
    serialize(): string {
        return serializeToJSON(this);
    }
}

export abstract class BaseStringSerializale {
    serialize(): String {
        return serializeToString(this);
    }
}

export function ClassDefinesSerializer<T extends { new (...args: any[]): {} }>(constructor: T) {
    return function () {
        Reflect.defineMetadata(ClassDefinesSerializerMetadataKey, true, constructor);
    }
}

export function ClassDefinesStringSerializer<T extends { new (...args: any[]): {} }>(constructor: T) {
    return function () {
        Reflect.defineMetadata(ClassDefinesStringSerializerMetadataKey, true, constructor);
    }
}

export function ClassDefinesJSONSerializer<T extends { new (...args: any[]): {} }>(constructor: T) {
    return function () {
        Reflect.defineMetadata(ClassDefinesJSONSerializerMetadataKey, true, constructor);
    }
}


export interface SerializableClass {
    serialize(): string;
}

export function SerializedProperty(serializationName: string|null = null) {
    return function (target: any, propertyKey: string) {
        let storedName = serializationName ?? propertyKey;
        Reflect.defineMetadata(SerializedPropertyMetadataKey, storedName, target, propertyKey);
    };
}



export function serializeToString(val: Date|boolean|number|symbol|object): string {
    if (val instanceof Date) {
        return Date.toString();
    }
    if (typeof val in ['boolean', 'number', 'symbol', 'string']) {
        return val.toString();
    }
    if (Reflect.hasMetadata(ClassDefinesSerializerMetadataKey, val)) {
        return (val as { serialize(): string }).serialize();
    }
    const strObj: Record<string, any> = {};
    const objVal = val as object;
    for (const propName in objVal) {
        if (Reflect.hasMetadata(SerializedPropertyMetadataKey, val, propName)) {
            const serializationName: string = Reflect.getMetadata(SerializedPropertyMetadataKey, val, propName);
            const rawValue = objVal[propName as keyof typeof objVal];
            if (typeof rawValue === "object") {
                const ownProps = Object.getOwnPropertyNames(rawValue);
                for (const innerPropNames of ownProps) {
                    strObj
                }
            }
            if (typeof rawValue !== "string") {
                strObj[serializationName] = serializeToString(rawValue);
            } else {
                strObj[serializationName] = rawValue;
            }
        }

    }
    return strObj.toString();
}

export function serializeToJSON(val: Date|boolean|string|number|symbol|object): string {
    if (typeof val === 'boolean') {
        return JSON.stringify(val);
    }
    if (val instanceof Date || (typeof val in ['string', 'number', 'symbol'])) {
        return val.toString();
    }
    if (typeof val === "object" && Reflect.hasMetadata(ClassDefinesJSONSerializerMetadataKey, val)) {
        return (val as { serialize(): string }).serialize();
    }
    const strObj: Record<string, any> = {};
    const props = Object.getOwnPropertyNames(val as object);
    for (const propName of props) {
        if (Reflect.hasMetadata(SerializedPropertyMetadataKey, val, propName)) {
            const serializationName: string = Reflect.getMetadata(SerializedPropertyMetadataKey, val, propName);
            const rawValue = val[propName as keyof typeof val];
            if (typeof rawValue !== "string") {
                strObj[serializationName] = serializeToJSON(rawValue);
            } else {
                strObj[serializationName] = rawValue;
            }
        }
    }
    return JSON.stringify(strObj, null, 2);
}

export type BasicTypes = string | boolean | Date | number | symbol;

export type Serializable =
    | BasicTypes
    | Iterable<Serializable>
    | Serializable[]
    | SerializableObject
    | MethodSerializableType;

export interface SerializableObject {
    [key: string|number|symbol]: Serializable;
}


export abstract class StringSerializable implements SerializableClass {
    serialize(): string {
        return serializeToString(this);
    }
}