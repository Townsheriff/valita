declare type PrettyIntersection<V> = Extract<{
    [K in keyof V]: V[K];
}, unknown>;
declare type Literal = string | number | bigint | boolean;
declare type Key = string | number;
declare type BaseType = "object" | "array" | "null" | "undefined" | "string" | "number" | "bigint" | "boolean" | "scalar";
declare type I<Code, Extra = unknown> = Readonly<PrettyIntersection<Extra & {
    code: Code;
    path?: Key[];
}>>;
declare type CustomError = undefined | string | {
    message?: string;
    path?: Key[];
};
declare type Issue = I<"invalid_type", {
    expected: BaseType[];
}> | I<"invalid_literal", {
    expected: Literal[];
}> | I<"invalid_length", {
    minLength: number;
    maxLength: number;
}> | I<"missing_key", {
    key: Key;
}> | I<"unrecognized_key", {
    key: Key;
}> | I<"invalid_union", {
    tree: IssueTree;
}> | I<"custom_error", {
    error: CustomError;
}>;
declare type IssueTree = Readonly<{
    code: "prepend";
    key: Key;
    tree: IssueTree;
}> | Readonly<{
    code: "join";
    left: IssueTree;
    right: IssueTree;
}> | Issue;
export declare type ValitaResult<V> = Readonly<{
    ok: true;
    value: V;
}> | Readonly<{
    ok: false;
    message: string;
    issues: readonly Issue[];
    throw(): never;
}>;
export declare class ValitaError extends Error {
    private readonly issueTree;
    constructor(issueTree: IssueTree);
    get issues(): readonly Issue[];
}
declare type RawResult<T> = true | Readonly<{
    code: "ok";
    value: T;
}> | IssueTree;
declare const enum FuncMode {
    PASS = 0,
    STRICT = 1,
    STRIP = 2
}
declare type Func<T> = (v: unknown, mode: FuncMode) => RawResult<T>;
declare type ParseOptions = {
    mode: "passthrough" | "strict" | "strip";
};
declare type ChainResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error?: CustomError;
};
declare function ok<T extends Literal>(value: T): {
    ok: true;
    value: T;
};
declare function ok<T>(value: T): {
    ok: true;
    value: T;
};
declare function err<E extends CustomError>(error?: E): {
    ok: false;
    error?: CustomError;
};
export declare type Infer<T extends AbstractType> = T extends AbstractType<infer I> ? I : never;
declare abstract class AbstractType<Output = unknown> {
    abstract readonly name: string;
    abstract genFunc(): Func<Output>;
    abstract toTerminals(into: TerminalType[]): void;
    get func(): Func<Output>;
    parse<T extends AbstractType>(this: T, v: unknown, options?: Partial<ParseOptions>): Infer<T>;
    try<T extends AbstractType>(this: T, v: unknown, options?: Partial<ParseOptions>): ValitaResult<Infer<T>>;
    optional(): Optional<Output>;
    default<T extends Literal>(defaultValue: T): Type<Exclude<Output, undefined> | T>;
    default<T>(defaultValue: T): Type<Exclude<Output, undefined> | T>;
    assert<T extends Output>(func: ((v: Output) => v is T) | ((v: Output) => boolean), error?: CustomError): Type<T>;
    map<T extends Literal>(func: (v: Output) => T): Type<T>;
    map<T>(func: (v: Output) => T): Type<T>;
    chain<T extends Literal>(func: (v: Output) => ChainResult<T>): Type<T>;
    chain<T>(func: (v: Output) => ChainResult<T>): Type<T>;
}
declare const isOptional: unique symbol;
declare type IfOptional<T extends AbstractType, Then, Else> = T extends Optional ? Then : Else;
declare abstract class Type<Output = unknown> extends AbstractType<Output> {
    protected readonly [isOptional] = false;
}
declare class Optional<Output = unknown> extends AbstractType<Output | undefined> {
    private readonly type;
    protected readonly [isOptional] = true;
    readonly name = "optional";
    constructor(type: AbstractType<Output>);
    genFunc(): Func<Output | undefined>;
    toTerminals(into: TerminalType[]): void;
}
declare type ObjectShape = Record<string, AbstractType>;
declare type Optionals<T extends ObjectShape> = {
    [K in keyof T]: IfOptional<T[K], K, never>;
}[keyof T];
declare type ObjectOutput<T extends ObjectShape, R extends AbstractType | undefined> = PrettyIntersection<{
    [K in Optionals<T>]?: Infer<T[K]>;
} & {
    [K in Exclude<keyof T, Optionals<T>>]: Infer<T[K]>;
} & (R extends Type<infer I> ? {
    [K: string]: I;
} : R extends Optional<infer J> ? Partial<{
    [K: string]: J;
}> : unknown)>;
declare class ObjectType<Shape extends ObjectShape = ObjectShape, Rest extends AbstractType | undefined = AbstractType | undefined> extends Type<ObjectOutput<Shape, Rest>> {
    readonly shape: Shape;
    private readonly restType;
    private readonly checks?;
    readonly name = "object";
    constructor(shape: Shape, restType: Rest, checks?: {
        func: (v: unknown) => boolean;
        issue: Issue;
    }[] | undefined);
    toTerminals(into: TerminalType[]): void;
    check(func: (v: ObjectOutput<Shape, Rest>) => boolean, error?: CustomError): ObjectType<Shape, Rest>;
    genFunc(): Func<ObjectOutput<Shape, Rest>>;
    rest<R extends Type>(restType: R): ObjectType<Shape, R>;
    extend<S extends ObjectShape>(shape: S): ObjectType<Omit<Shape, keyof S> & S, Rest>;
    pick<K extends (keyof Shape)[]>(...keys: K): ObjectType<Pick<Shape, K[number]>, undefined>;
    omit<K extends (keyof Shape)[]>(...keys: K): ObjectType<Omit<Shape, K[number]>, Rest>;
    partial(): ObjectType<{
        [K in keyof Shape]: Optional<Infer<Shape[K]>>;
    }, Rest extends AbstractType<infer I> ? Optional<I> : undefined>;
}
declare type TupleOutput<T extends Type[]> = {
    [K in keyof T]: T[K] extends Type<infer U> ? U : never;
};
declare type ArrayOutput<Head extends Type[], Rest extends Type | undefined> = [
    ...TupleOutput<Head>,
    ...(Rest extends Type ? Infer<Rest>[] : [])
];
declare class ArrayType<Head extends Type[] = Type[], Rest extends Type | undefined = Type | undefined> extends Type<ArrayOutput<Head, Rest>> {
    readonly head: Head;
    readonly rest?: Rest | undefined;
    readonly name = "array";
    constructor(head: Head, rest?: Rest | undefined);
    toTerminals(into: TerminalType[]): void;
    genFunc(): Func<ArrayOutput<Head, Rest>>;
}
declare class UnionType<T extends Type[] = Type[]> extends Type<Infer<T[number]>> {
    readonly options: T;
    readonly name = "union";
    constructor(options: T);
    toTerminals(into: TerminalType[]): void;
    genFunc(): Func<Infer<T[number]>>;
    optional(): Optional<Infer<T[number]>>;
}
declare class NeverType extends Type<never> {
    readonly name = "never";
    genFunc(): Func<never>;
    toTerminals(into: TerminalType[]): void;
}
declare class UnknownType extends Type<unknown> {
    readonly name = "unknown";
    genFunc(): Func<unknown>;
    toTerminals(into: TerminalType[]): void;
}
declare class NumberType extends Type<number> {
    readonly name = "number";
    genFunc(): Func<number>;
    toTerminals(into: TerminalType[]): void;
}
declare class StringType extends Type<string> {
    readonly name = "string";
    genFunc(): Func<string>;
    toTerminals(into: TerminalType[]): void;
}
declare class Scalar<T> extends Type<T> {
    readonly name = "scalar";
    genFunc(): Func<T>;
    toTerminals(into: TerminalType[]): void;
}
declare class BigIntType extends Type<bigint> {
    readonly name = "bigint";
    genFunc(): Func<bigint>;
    toTerminals(into: TerminalType[]): void;
}
declare class BooleanType extends Type<boolean> {
    readonly name = "boolean";
    genFunc(): Func<boolean>;
    toTerminals(into: TerminalType[]): void;
}
declare class UndefinedType extends Type<undefined> {
    readonly name = "undefined";
    genFunc(): Func<undefined>;
    toTerminals(into: TerminalType[]): void;
}
declare class NullType extends Type<null> {
    readonly name = "null";
    genFunc(): Func<null>;
    toTerminals(into: TerminalType[]): void;
}
declare class LiteralType<Out extends Literal = Literal> extends Type<Out> {
    readonly value: Out;
    readonly name = "literal";
    constructor(value: Out);
    genFunc(): Func<Out>;
    toTerminals(into: TerminalType[]): void;
}
declare function never(): Type<never>;
declare function unknown(): Type<unknown>;
declare function number(): Type<number>;
declare function bigint(): Type<bigint>;
declare function string(): Type<string>;
declare function scalar<T = unknown>(): Type<T>;
declare function boolean(): Type<boolean>;
declare function undefined_(): Type<undefined>;
declare function null_(): Type<null>;
declare function literal<T extends Literal>(value: T): Type<T>;
declare function object<T extends Record<string, Type | Optional>>(obj: T): ObjectType<T, undefined>;
declare function record<T extends Type>(valueType: T): Type<Record<string, Infer<T>>>;
declare function array<T extends Type>(item: T): ArrayType<[], T>;
declare function tuple<T extends [] | [Type, ...Type[]]>(items: T): ArrayType<T, undefined>;
declare function union<T extends Type[]>(...options: T): Type<Infer<T[number]>>;
declare function lazy<T>(definer: () => Type<T>): Type<T>;
declare type TerminalType = NeverType | UnknownType | StringType | NumberType | BigIntType | BooleanType | UndefinedType | NullType | ObjectType | ArrayType | LiteralType | Optional | Scalar<unknown>;
export { never, unknown, number, bigint, string, boolean, object, record, array, tuple, literal, union, null_ as null, undefined_ as undefined, scalar, lazy, ok, err, };
export type { Type, Optional };
export type { ObjectType, UnionType, ArrayType };
//# sourceMappingURL=index.d.ts.map