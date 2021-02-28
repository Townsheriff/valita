type IssueCode =
  | "invalid_type"
  | "invalid_literal_value"
  | "missing_key"
  | "unrecognized_key";

type IssuePath = (string | number)[];

type Issue = {
  code: IssueCode;
  path: IssuePath;
  message: string;
};

function _collectIssues(
  ctx: ErrorContext,
  path: IssuePath,
  issues: Issue[]
): void {
  if (ctx.type === "error") {
    issues.push({
      code: ctx.code,
      path: path.slice(),
      message: ctx.message,
    });
  } else {
    if (ctx.next) {
      _collectIssues(ctx.next, path, issues);
    }
    path.push(ctx.value);
    _collectIssues(ctx.current, path, issues);
    path.pop();
  }
}

function collectIssues(ctx: ErrorContext): Issue[] {
  const issues: Issue[] = [];
  const path: IssuePath = [];
  _collectIssues(ctx, path, issues);
  return issues;
}

export class ValitaError extends Error {
  constructor(private readonly ctx: ErrorContext) {
    super();
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
  }

  get issues(): readonly Issue[] {
    const issues = collectIssues(this.ctx);
    Object.defineProperty(this, "issues", {
      value: issues,
      writable: false,
    });
    return issues;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type PrettifyObjectType<V> = Extract<{ [K in keyof V]: V[K] }, unknown>;

type ErrorContext = Readonly<
  | {
      ok: false;
      type: "path";
      value: string | number;
      current: ErrorContext;
      next?: ErrorContext;
    }
  | {
      ok: false;
      type: "error";
      code: IssueCode;
      message: string;
    }
>;
type Ok<T> =
  | true
  | Readonly<{
      ok: true;
      value: T;
    }>;
type Result<T> = Ok<T> | ErrorContext;

function err(code: IssueCode, message: string): ErrorContext {
  return { ok: false, type: "error", code, message };
}

function appendErr(
  to: ErrorContext | undefined,
  key: string | number,
  err: ErrorContext
): ErrorContext {
  return {
    ok: false,
    type: "path",
    value: key,
    current: err,
    next: to,
  };
}

type Infer<T extends Vx<unknown>> = T extends Vx<infer I> ? I : never;

class Vx<T> {
  constructor(
    private readonly genFunc: () => (v: unknown) => Result<T>,
    readonly isOptional: boolean
  ) {}

  get func(): (v: unknown) => Result<T> {
    const f = this.genFunc();
    Object.defineProperty(this, "func", {
      value: f,
      writable: false,
    });
    return f;
  }

  transform<O>(func: (v: T) => Result<O>): Vx<O> {
    const f = this.func;
    return new Vx(
      () => (v) => {
        const r = f(v);
        if (r !== true && !r.ok) {
          return r;
        }
        return func(r === true ? (v as T) : r.value);
      },
      this.isOptional
    );
  }

  parse(v: unknown): T {
    const r = this.func(v);
    if (r === true) {
      return v as T;
    } else if (r.ok) {
      return r.value;
    } else {
      throw new ValitaError(r);
    }
  }

  optional(): Vx<T | undefined> {
    const f = this.func;
    return new Vx(
      () => (v) => {
        return v === undefined ? true : f(v);
      },
      true
    );
  }
}

type Optionals<T extends Record<string, Vx<unknown>>> = {
  [K in keyof T]: undefined extends Infer<T[K]> ? K : never;
}[keyof T];

type UnknownKeys = "passthrough" | "strict" | "strip" | Vx<unknown>;

type VxObjOutput<
  T extends Record<string, Vx<unknown>>,
  U extends UnknownKeys
> = PrettifyObjectType<
  { [K in Optionals<T>]?: Infer<T[K]> } &
    { [K in Exclude<keyof T, Optionals<T>>]: Infer<T[K]> } &
    (U extends "passthrough" ? { [K: string]: unknown } : unknown) &
    (U extends Vx<infer C> ? { [K: string]: C } : unknown)
>;

class VxObj<
  T extends Record<string, Vx<unknown>>,
  U extends UnknownKeys
> extends Vx<VxObjOutput<T, U>> {
  constructor(private readonly shape: T, private readonly unknownKeys: U) {
    super(() => {
      const shape = this.shape;
      const strip = this.unknownKeys === "strip";
      const strict = this.unknownKeys === "strict";
      const passthrough = this.unknownKeys === "passthrough";
      const catchall =
        this.unknownKeys instanceof Vx
          ? (this.unknownKeys.func as (v: unknown) => Result<unknown>)
          : undefined;

      const keys: string[] = [];
      const funcs: ((v: unknown) => Result<unknown>)[] = [];
      const required: boolean[] = [];
      const knownKeys = Object.create(null);
      const shapeTemplate = {} as Record<string, unknown>;
      for (const key in shape) {
        keys.push(key);
        funcs.push(shape[key].func);
        required.push(!shape[key].isOptional);
        knownKeys[key] = true;
        shapeTemplate[key] = undefined;
      }

      return (obj) => {
        if (!isObject(obj)) {
          return err("invalid_type", "expected an object");
        }
        let ctx: ErrorContext | undefined = undefined;
        let output: Record<string, unknown> = obj;
        const template = strict || strip ? shapeTemplate : obj;
        if (!passthrough) {
          for (const key in obj) {
            if (!knownKeys[key]) {
              if (strict) {
                return err(
                  "unrecognized_key",
                  `unrecognized key ${JSON.stringify(key)}`
                );
              } else if (strip) {
                output = { ...template };
                break;
              } else if (catchall) {
                const r = catchall(obj[key]);
                if (r !== true) {
                  if (r.ok) {
                    if (output === obj) {
                      output = { ...template };
                    }
                    output[key] = r.value;
                  } else {
                    ctx = appendErr(ctx, key, r);
                  }
                }
              }
            }
          }
        }
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = obj[key];

          if (value === undefined && required[i]) {
            ctx = appendErr(ctx, key, err("missing_key", `missing key`));
          } else {
            const r = funcs[i](value);
            if (r !== true) {
              if (r.ok) {
                if (output === obj) {
                  output = { ...template };
                }
                output[keys[i]] = r.value;
              } else {
                ctx = appendErr(ctx, key, r);
              }
            }
          }
        }

        if (ctx) {
          return ctx;
        } else if (obj === output) {
          return true;
        } else {
          return { ok: true, value: output as VxObjOutput<T, U> };
        }
      };
    }, false);
  }
  passthrough(): VxObj<T, "passthrough"> {
    return new VxObj(this.shape, "passthrough");
  }
  strict(): VxObj<T, "strict"> {
    return new VxObj(this.shape, "strict");
  }
  strip(): VxObj<T, "strip"> {
    return new VxObj(this.shape, "strip");
  }
  catchall<C extends Vx<unknown>>(catchall: C): VxObj<T, C> {
    return new VxObj(this.shape, catchall);
  }
}

class VxArr<T extends Vx<unknown>> extends Vx<Infer<T>[]> {
  constructor(private readonly item: T) {
    super(() => {
      const func = this.item.func;
      return (arr) => {
        if (!Array.isArray(arr)) {
          return err("invalid_type", "expected an array");
        }
        let ctx: ErrorContext | undefined = undefined;
        let output: Infer<T>[] = arr;
        for (let i = 0; i < arr.length; i++) {
          const r = func(arr[i]);
          if (r !== true) {
            if (r.ok) {
              if (output === arr) {
                output = arr.slice();
              }
              output[i] = r.value as Infer<T>;
            } else {
              ctx = appendErr(ctx, i, r);
            }
          }
        }
        if (ctx) {
          return ctx;
        } else if (arr === output) {
          return true;
        } else {
          return { ok: true, value: output };
        }
      };
    }, false);
  }
}

function number(): Vx<number> {
  const e = err("invalid_type", "expected a number");
  return new Vx(() => (v) => (typeof v === "number" ? true : e), false);
}
function string(): Vx<string> {
  const e = err("invalid_type", "expected a string");
  return new Vx(() => (v) => (typeof v === "string" ? true : e), false);
}
function boolean(): Vx<boolean> {
  const e = err("invalid_type", "expected a boolean");
  return new Vx(() => (v) => (typeof v === "boolean" ? true : e), false);
}
function object<T extends Record<string, Vx<unknown>>>(
  obj: T
): VxObj<T, "strict"> {
  return new VxObj(obj, "strict");
}
function array<T extends Vx<unknown>>(item: T): VxArr<T> {
  return new VxArr(item);
}
function literal<T extends string | number | boolean | bigint>(
  value: T
): Vx<T> {
  const exp = typeof value === "bigint" ? `${value}n` : JSON.stringify(value);
  const e = err("invalid_literal_value", `expected ${exp}`);
  return new Vx(() => (v) => (v === value ? true : e), false);
}
function undefined_(): Vx<undefined> {
  const e = err("invalid_type", "expected undefined");
  return new Vx(() => (v) => (v === undefined ? true : e), true);
}
function null_(): Vx<null> {
  const e = err("invalid_type", "expected null");
  return new Vx(() => (v) => (v === null ? true : e), false);
}

export {
  number,
  string,
  boolean,
  object,
  array,
  literal,
  null_ as null,
  undefined_ as undefined,
};

export type { Infer as infer };
