import { expect } from "chai";
import { TypeEqual } from "ts-expect";
import * as v from "../src";

// A helper for checking whether the given validator's
// inferred output type is _exactly_ the same as given one.
// For example the following are valid:
//  expectType(v.number()).toImply<number>(true);
//  expectType(v.number()).toImply<1>(false);
//  expectType(v.number()).toImply<string>(false);
//  expectType(v.number()).toImply<string | number>(false);
//  expectType(v.number()).toImply<unknown>(false);
//  expectType(v.number()).toImply<any>(false);
//  expectType(v.number()).toImply<never>(false);
function expectType<T extends v.Type>(
  _type: T
): {
  toImply<M>(_truth: TypeEqual<v.Infer<T>, M>): void;
} {
  return { toImply: () => void {} };
}

describe("Type", () => {
  describe("parse", () => {
    it("returns T when called for v.Type<T>", () => {
      function _<T>(type: v.Type<T>, value: unknown): T {
        return type.parse(value);
      }
    });
    it("returns type v.Infer<...>", () => {
      function _<T extends v.Type>(type: T, value: unknown): v.Infer<T> {
        return type.parse(value);
      }
    });
  });

  describe("pass", () => {
    it("returns true when T passes", () => {
      const t = v.number();
      expect(t.pass(2)).to.eq(true);
    });

    it("returns false when T fails", () => {
      const t = v.number();
      expect(t.pass("a")).to.eq(false);
    });
  });
  describe("assert", () => {
    it("passes the type through by default", () => {
      const t = v.number().assert(() => true);
      expectType(t).toImply<number>(true);
    });
    it("turns optional input into non-optional output", () => {
      const t = v.object({
        a: v
          .number()
          .optional()
          .assert(() => true),
      });
      expect(t.parse({})).to.deep.equal({ a: undefined });
      expectType(t).toImply<{ a: number | undefined }>(true);
    });
    it("accepts type predicates", () => {
      type Branded = number & { readonly brand: unique symbol };
      const t = v.number().assert((n): n is Branded => true);
      expectType(t).toImply<Branded>(true);
      expectType(t).toImply<number>(false);
    });
    it("accepts type parameters", () => {
      const t = v.number().assert<1>((n) => n === 1);
      expectType(t).toImply<1>(true);
    });
    it("passes in the parsed value", () => {
      let value: unknown;
      const t = v.number().assert((v) => {
        value = v;
        return true;
      });
      t.parse(1000);
      expect(value).to.equal(1000);
    });
    it("passes the value through on success", () => {
      const t = v.number().assert(() => true);
      expect(t.parse(1000)).to.equal(1000);
    });
    it("creates a custom error on failure", () => {
      const t = v.number().assert(() => false);
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.includes({ code: "custom_error" });
    });
    it("allows passing in a custom error message", () => {
      const t = v.number().assert(() => false, "test");
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "test",
        });
    });
    it("allows passing in a custom error message in an object", () => {
      const t = v.number().assert(() => false, { message: "test" });
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: { message: "test" },
        });
    });
    it("allows passing in a error path", () => {
      const t = v.number().assert(() => false, { path: ["test"] });
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          path: ["test"],
        });
    });
    it("runs multiple asserts in order", () => {
      const t = v
        .string()
        .assert((s) => s !== "a", "a")
        .assert(() => false, "b");
      expect(() => t.parse("a"))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "a",
        });
      expect(() => t.parse("b"))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "b",
        });
    });
    it("always gets the value transformed by previous maps and chains", () => {
      const x = {};
      const t = v
        .string()
        .assert((s) => s === "a")
        .map(() => x)
        .assert((s) => s === x);
      expect(t.parse("a")).to.equal(x);
    });
  });
  describe("map", () => {
    it("changes the output type to the function's return type", () => {
      const t = v.number().map(String);
      expectType(t).toImply<string>(true);
    });
    it("infers literals when possible", () => {
      const t = v.number().map(() => "test");
      expectType(t).toImply<"test">(true);
    });
    it("passes in the parsed value", () => {
      let value: unknown;
      const t = v.number().map((v) => (value = v));
      t.parse(1000);
      expect(value).to.equal(1000);
    });
    it("passes on the return value", () => {
      const t = v.number().map(() => "test");
      expect(t.parse(1000)).to.equal("test");
    });
    it("runs multiple maps in order", () => {
      const t = v
        .string()
        .map((s) => s + "b")
        .map((s) => s + "c");
      expect(t.parse("a")).to.equal("abc");
    });
  });
  describe("chain", () => {
    it("changes the output type to the function's return type", () => {
      const t = v.number().chain((n) => v.ok(String(n)));
      expectType(t).toImply<string>(true);
    });
    it("infers literals when possible", () => {
      const t = v.number().chain(() => ({ ok: true, value: "test" }));
      expectType(t).toImply<"test">(true);
    });
    it("passes in the parsed value", () => {
      let value: unknown;
      const t = v.number().chain((n) => {
        value = n;
        return v.ok("test");
      });
      t.parse(1000);
      expect(value).to.equal(1000);
    });
    it("passes on the success value", () => {
      const t = v.number().chain(() => v.ok("test"));
      expect(t.parse(1)).to.equal("test");
    });
    it("fails on error result", () => {
      const t = v.number().chain(() => v.err());
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
        });
    });
    it("allows passing in a custom error message", () => {
      const t = v.number().chain(() => v.err("test"));
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "test",
        });
    });
    it("allows passing in a custom error message in an object", () => {
      const t = v.number().chain(() => v.err({ message: "test" }));
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: { message: "test" },
        });
    });
    it("allows passing in an error path", () => {
      const t = v.number().chain(() => v.err({ path: ["test"] }));
      expect(() => t.parse(1))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          path: ["test"],
        });
    });
    it("runs multiple chains in order", () => {
      const t = v
        .string()
        .chain((s) => v.ok(s + "b"))
        .chain((s) => v.ok(s + "c"));
      expect(t.parse("a")).to.equal("abc");
    });
  });
  describe("optional()", () => {
    it("accepts missing values", () => {
      const t = v.object({
        a: v.string().optional(),
      });
      expect(t.parse({})).to.deep.equal({});
    });
    it("accepts undefined", () => {
      const t = v.object({
        a: v.string().optional(),
      });
      expect(t.parse({ a: undefined })).to.deep.equal({ a: undefined });
    });
    it("accepts the original type", () => {
      const t = v.object({
        missing: v.string().optional(),
      });
      expect(t.parse({ a: "test" })).to.deep.equal({ a: "test" });
    });
    it("adds undefined to output", () => {
      const t = v.string().optional();
      expectType(t).toImply<string | undefined>(true);
    });
    it("makes the output type optional", () => {
      const t1 = v.object({ a: v.number().optional() });
      expectType(t1).toImply<{ a?: number | undefined }>(true);
    });
    it("short-circuits previous optionals", () => {
      const t = v.object({
        a: v
          .string()
          .optional()
          .map(() => 1)
          .optional(),
      });
      expect(t.parse({ a: undefined })).to.deep.equal({ a: undefined });
      expectType(t).toImply<{ a?: 1 | undefined }>(true);
    });
    it("short-circuits undefined()", () => {
      const t = v.object({
        a: v
          .undefined()
          .map(() => 1)
          .optional(),
      });
      expect(t.parse({ a: undefined })).to.deep.equal({ a: undefined });
      expectType(t).toImply<{ a?: 1 | undefined }>(true);
    });
    it("passes undefined to assert() for missing values", () => {
      let value: unknown = null;
      const t = v.object({
        missing: v
          .string()
          .optional()
          .assert((input) => {
            value = input;
            return true;
          }),
      });
      t.parse({});
      expect(value).to.be.undefined;
    });
    it("passes undefined to map() for missing values", () => {
      let value: unknown = null;
      const t = v.object({
        missing: v
          .string()
          .optional()
          .map((input) => {
            value = input;
          }),
      });
      t.parse({});
      expect(value).to.be.undefined;
    });
    it("passes undefined to chain() for missing values", () => {
      let value: unknown = null;
      const t = v.object({
        missing: v
          .string()
          .optional()
          .chain((input) => {
            value = input;
            return v.ok(true);
          }),
      });
      t.parse({});
      expect(value).to.be.undefined;
    });
  });
  describe("default", () => {
    it("accepts undefined", () => {
      const t = v.number().default(2);
      expect(t.parse(undefined)).to.deep.equal(2);
    });
    it("maps undefined output from any parser", () => {
      const t = v
        .string()
        .map(() => undefined)
        .default(2);
      expect(t.parse("test")).to.deep.equal(2);
    });
    it("makes input optional", () => {
      const t = v.object({
        a: v.number().default(2),
      });
      expect(t.parse({})).to.deep.equal({ a: 2 });
    });
    it("infers literals when possible", () => {
      const t = v.undefined().default(2);
      expectType(t).toImply<2>(true);
    });
    it("removes undefined from the return type", () => {
      const t = v.union(v.string(), v.undefined()).default(2);
      expectType(t).toImply<string | 2>(true);
    });
    it("considers missing values undefined in object keys", () => {
      const t = v.object({
        a: v
          .union(
            v.string().optional(),
            v.undefined().map(() => "string")
          )
          .default(2),
      });
      expectType(t).toImply<{ a: 2 | string }>(true);
    });
  });
});

describe("never()", () => {
  it("rejects everything", () => {
    const t = v.never();
    for (const val of ["1", 1, 1n, true, null, undefined, [], {}]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
  it("has output type 'never'", () => {
    const t = v.never();
    expectType(t).toImply<never>(true);
  });
  it("never propagates to assert()", () => {
    let called = false;
    const t = v.never().assert(() => {
      called = true;
      return true;
    });
    expect(() => t.parse(null)).to.throw(v.ValitaError);
    expect(called).to.be.false;
  });
  it("never propagates to map()", () => {
    let called = false;
    const t = v.never().map(() => {
      called = true;
    });
    expect(() => t.parse(null)).to.throw(v.ValitaError);
    expect(called).to.be.false;
  });
  it("never propagates to chain()", () => {
    let called = false;
    const t = v.never().chain(() => {
      called = true;
      return v.ok(true);
    });
    expect(() => t.parse(null)).to.throw(v.ValitaError);
    expect(called).to.be.false;
  });
});

describe("string()", () => {
  it("accepts strings", () => {
    const t = v.string();
    expect(t.parse("test")).to.equal("test");
  });
  it("rejects other types", () => {
    const t = v.string();
    for (const val of [1, 1n, true, null, undefined, [], {}]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
});

describe("unknown()", () => {
  it("accepts anything", () => {
    const t = v.unknown();
    for (const val of ["test", 1, 1n, true, null, undefined, [], {}]) {
      expect(t.parse(val)).to.equal(val);
    }
  });
});

describe("number()", () => {
  it("accepts numbers", () => {
    const t = v.number();
    expect(t.parse(1)).to.equal(1);
  });
  it("rejects other types", () => {
    const t = v.number();
    for (const val of ["1", 1n, true, null, undefined, [], {}]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
});

describe("bigint()", () => {
  it("accepts bigints", () => {
    const t = v.bigint();
    expect(t.parse(1n)).to.equal(1n);
  });
  it("rejects other types", () => {
    const t = v.bigint();
    for (const val of ["1", 1, true, null, undefined, [], {}]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
});

describe("boolean()", () => {
  it("accepts booleans", () => {
    const t = v.boolean();
    expect(t.parse(true)).to.equal(true);
  });
  it("rejects other types", () => {
    const t = v.boolean();
    for (const val of ["1", 1, 1n, null, undefined, [], {}]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
});

describe("object()", () => {
  it("acceps empty objects", () => {
    const t = v.object({});
    expect(t.parse({})).to.deep.equal({});
    // eslint-disable-next-line @typescript-eslint/ban-types
    expectType(t).toImply<{}>(true);
  });
  it("infers required keys object({})", () => {
    const t = v.object({
      a: v.object({}),
    });
    // eslint-disable-next-line @typescript-eslint/ban-types
    expectType(t).toImply<{ a: {} }>(true);
  });
  it("infers optional keys for optional()", () => {
    const t = v.object({
      a: v.undefined().optional(),
    });
    expectType(t).toImply<{ a?: undefined }>(true);
  });
  it("infers required keys for never()", () => {
    const t = v.object({
      a: v.never(),
    });
    expectType(t).toImply<{ a: never }>(true);
  });
  it("infers required keys for undefined()", () => {
    const t = v.object({
      a: v.undefined(),
    });
    expectType(t).toImply<{ a: undefined }>(true);
  });
  it("infers required keys for unknown()", () => {
    const t = v.object({
      a: v.unknown(),
    });
    expectType(t).toImply<{ a: unknown }>(true);
  });
  it("throws on missing required keys", () => {
    const t = v.object({ a: v.string() });
    expect(() => t.parse({}))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0].code", "missing_key");
  });
  it("does not throw on missing optional keys", () => {
    const t = v.object({ a: v.string().optional() });
    expect(t.parse({})).to.deep.equal({});
  });
  it("returns the original object instance if possible", () => {
    const t = v.object({ a: v.number() });
    const o = { a: 1 };
    expect(t.parse(o)).to.equal(o);
  });
  it("returns a new object instance if the fields change", () => {
    const t = v.object({
      a: v.number().map(() => "test"),
    });
    const o = { a: 1 };
    expect(t.parse(o)).to.not.equal(o);
  });
  it("rejects other types", () => {
    const t = v.object({});
    for (const val of ["1", 1n, true, null, undefined, []]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
  it("checks non-enumerable required keys", () => {
    const t = v.object({ a: v.string() });
    const o = {};
    Object.defineProperty(o, "a", {
      value: 1,
      enumerable: false,
    });
    expect(() => t.parse(o))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        path: ["a"],
        expected: ["string"],
      });
  });
  it("checks non-enumerable optional keys", () => {
    const t = v.object({ a: v.string().optional() });
    const o = {};
    Object.defineProperty(o, "a", {
      value: 1,
      enumerable: false,
    });
    expect(() => t.parse(o))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        path: ["a"],
        expected: ["string"],
      });
  });
  it("passes through unrecognized keys by default", () => {
    const t = v.object({ a: v.number() });
    const o = t.parse({ a: 1, b: 2 });
    expect(o).to.deep.equal({ a: 1, b: 2 });
  });
  it("passes through unrecognized keys when mode=passthrough", () => {
    const t = v.object({ a: v.number() });
    const o = t.parse({ a: 1, b: 2 }, { mode: "passthrough" });
    expect(o).to.deep.equal({ a: 1, b: 2 });
  });
  it("strips unrecognized keys when mode=strip", () => {
    const t = v.object({ a: v.number() });
    const o = t.parse({ a: 1, b: 2 }, { mode: "strip" });
    expect(o).to.deep.equal({ a: 1 });
  });
  it("strips unrecognized keys when mode=strip and there are transformed values", () => {
    const t = v.object({ a: v.number().map((x) => x + 1) });
    const o = t.parse({ a: 1, b: 2 }, { mode: "strip" });
    expect(o).to.deep.equal({ a: 2 });
  });
  it("fails on unrecognized keys when mode=strict", () => {
    const t = v.object({ a: v.number() });
    expect(() => t.parse({ a: 1, b: 2 }, { mode: "strict" }))
      .to.throw(v.ValitaError)
      .with.nested.include({
        "issues[0].code": "unrecognized_key",
        "issues[0].key": "b",
      });
  });
  it("keeps missing optionals missing when mode=strip", () => {
    const t = v.object({ a: v.number().optional() });
    const o = t.parse({ b: 2 }, { mode: "strip" });
    expect(o).to.deep.equal({});
  });
  it("forwards parsing mode to nested types", () => {
    const t = v.object({ nested: v.object({ a: v.number() }) });
    const i = { nested: { a: 1, b: 2 } };
    expect(t.parse(i)).to.equal(i);
    expect(t.parse(i, { mode: "passthrough" })).to.equal(i);
    expect(t.parse(i, { mode: "strip" })).to.deep.equal({ nested: { a: 1 } });
    expect(() => t.parse(i, { mode: "strict" })).to.throw(v.ValitaError);
  });

  describe("omit", () => {
    it("omits given keys", () => {
      const t = v.object({ a: v.literal(1), b: v.literal(2) }).omit("b");
      expectType(t).toImply<{ a: 1 }>(true);
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    });
    it("allows zero arguments", () => {
      const t = v.object({ a: v.literal(1), b: v.literal(2) }).omit();
      expectType(t).toImply<{ a: 1; b: 2 }>(true);
      expect(t.parse({ a: 1, b: 2 })).to.deep.equal({ a: 1, b: 2 });
    });
    it("allows multiple", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2), c: v.literal(3) })
        .omit("a", "b");
      expectType(t).toImply<{ c: 3 }>(true);
      expect(t.parse({ c: 3 })).to.deep.equal({ c: 3 });
    });
    it("keeps rest", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2) })
        .rest(v.number())
        .omit("b");
      expectType(t).toImply<{ a: 1; [K: string]: number }>(true);
      expect(t.parse({ a: 1, b: 1000 })).to.deep.equal({ a: 1, b: 1000 });
    });
    it("removes checks", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2) })
        .check(() => false)
        .omit("b");
      expectType(t).toImply<{ a: 1 }>(true);
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    });
  });

  describe("pick", () => {
    it("omits given keys", () => {
      const t = v.object({ a: v.literal(1), b: v.literal(2) }).pick("a");
      expectType(t).toImply<{ a: 1 }>(true);
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    });
    it("allows zero arguments", () => {
      const t = v.object({ a: v.literal(1), b: v.literal(2) }).pick();
      // eslint-disable-next-line @typescript-eslint/ban-types
      expectType(t).toImply<{}>(true);
      expect(t.parse({})).to.deep.equal({});
    });
    it("allows multiple", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2), c: v.literal(3) })
        .pick("a", "b");
      expectType(t).toImply<{ a: 1; b: 2 }>(true);
      expect(t.parse({ a: 1, b: 2 })).to.deep.equal({ a: 1, b: 2 });
    });
    it("removes rest", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2) })
        .rest(v.string())
        .pick("a");
      expectType(t).toImply<{ a: 1 }>(true);
      expect(() => t.parse({ a: 1, b: "test" }, { mode: "strict" })).to.throw(
        v.ValitaError
      );
    });
    it("removes checks", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2) })
        .check(() => false)
        .pick("a");
      expectType(t).toImply<{ a: 1 }>(true);
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    });
  });

  describe("partial", () => {
    it("makes all keys optional", () => {
      const t = v.object({ a: v.literal(1), b: v.literal(2) }).partial();
      expectType(t).toImply<Partial<{ a: 1; b: 2 }>>(true);
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    });
    it("makes rest accept undefined as well as the original type", () => {
      it("makes all keys optional", () => {
        const t = v
          .object({ a: v.literal(1) })
          .rest(v.number())
          .partial();
        expectType(t).toImply<Partial<{ a: 1; [K: string]: number }>>(true);
        expect(t.parse({ a: 1, x: undefined, y: 1000 })).to.deep.equal({
          a: 1,
          x: undefined,
          y: 1000,
        });
      });
      const t = v
        .object({ a: v.literal(1), b: v.literal(2) })
        .rest(v.number())
        .omit("b");
      expectType(t).toImply<{ a: 1; [K: string]: number }>(true);
      expect(t.parse({ a: 1, b: 1000 })).to.deep.equal({ a: 1, b: 1000 });
    });
    it("removes checks", () => {
      const t = v
        .object({ a: v.literal(1), b: v.literal(2) })
        .check(() => false)
        .partial();
      expectType(t).toImply<Partial<{ a: 1; b: 2 }>>(true);
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    });
  });

  describe("rest", () => {
    it("adds an index signature to the inferred type", () => {
      const t = v.object({ a: v.literal(1) }).rest(v.number());
      expectType(t).toImply<{ a: 1; [K: string]: number }>(true);
      expectType(t).toImply<{ a: string }>(false);
    });
    it("accepts matching unexpected key values", () => {
      const t = v.object({ a: v.literal("test") }).rest(v.literal(1));
      expect(t.parse({ a: "test", b: 1 })).to.deep.equal({ a: "test", b: 1 });
    });
    it("returns the original object instance if possible", () => {
      const t = v.object({ a: v.number() }).rest(v.number());
      const o = { a: 1, b: 2 };
      expect(t.parse(o)).to.equal(o);
    });
    it("returns a new object instance if the fields change", () => {
      const t = v
        .object({
          a: v.number(),
        })
        .rest(v.number().map((x) => x));
      const o = { a: 1, b: 2 };
      expect(t.parse(o)).to.not.equal(o);
    });

    it("ignores non-enumerable keys", () => {
      const t = v.object({ a: v.literal("test") }).rest(v.literal(1));
      const o = { a: "test" };
      Object.defineProperty(o, "b", {
        value: "string",
        enumerable: false,
      });
      expect(t.parse(o)).to.deep.equal({ a: "test" });
    });
    it("rejects non-matching unexpected key values", () => {
      const t = v.object({ a: v.literal("test") }).rest(v.literal(1));
      expect(() => t.parse({ a: "test", b: 2 }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues")
        .with.lengthOf(1)
        .that.deep.includes({
          code: "invalid_literal",
          path: ["b"],
          expected: [1],
        });
    });
    it("applies only to unexpected keys", () => {
      const t = v.object({ a: v.literal("test") }).rest(v.literal(1));
      expect(() => t.parse({ a: 1 }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues")
        .with.lengthOf(1)
        .that.deep.includes({
          code: "invalid_literal",
          path: ["a"],
          expected: ["test"],
        });
    });
    it("takes precedence over mode=strict", () => {
      const t = v.object({}).rest(v.literal(1));
      expect(t.parse({ a: 1 }, { mode: "strict" })).to.deep.equal({ a: 1 });
      expect(() => t.parse({ a: 2 }, { mode: "strict" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues")
        .with.lengthOf(1)
        .that.deep.includes({
          code: "invalid_literal",
          path: ["a"],
          expected: [1],
        });
    });
    it("takes precedence over mode=strip", () => {
      const t = v.object({}).rest(v.literal(1));
      expect(t.parse({ a: 1 }, { mode: "strip" })).to.deep.equal({ a: 1 });
      expect(() => t.parse({ a: 2 }, { mode: "strip" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues")
        .with.lengthOf(1)
        .that.deep.includes({
          code: "invalid_literal",
          path: ["a"],
          expected: [1],
        });
    });
    it("takes precedence over mode=passthrough", () => {
      const t = v.object({}).rest(v.literal(1));
      expect(t.parse({ a: 1 }, { mode: "passthrough" })).to.deep.equal({
        a: 1,
      });
      expect(() => t.parse({ a: 2 }, { mode: "passthrough" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues")
        .with.lengthOf(1)
        .that.deep.includes({
          code: "invalid_literal",
          path: ["a"],
          expected: [1],
        });
    });
  });

  it("attaches paths to issues", () => {
    const t = v.object({
      type: v.literal(2),
      other: v.literal("test"),
    });
    expect(() => t.parse({ type: 2, other: "not_test" }))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_literal",
        path: ["other"],
        expected: ["test"],
      });
  });
  it("attaches nested paths to issues", () => {
    const t = v.object({
      type: v.literal(2),
      other: v.object({
        key: v.literal("test"),
      }),
    });
    expect(() => t.parse({ type: 2, other: { key: "not_test" } }))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_literal",
        path: ["other", "key"],
        expected: ["test"],
      });
  });
  describe("extend()", () => {
    it("extends the base shape", () => {
      const t = v.object({ a: v.string() }).extend({ b: v.number() });
      expect(t.parse({ a: "test", b: 1 })).to.deep.equal({ a: "test", b: 1 });
      expectType(t).toImply<{ a: string; b: number }>(true);
    });
    it("overwrites already existing keys", () => {
      const t = v.object({ a: v.string() }).extend({ a: v.number() });
      expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
      expect(() => t.parse({ a: "test" })).to.throw(v.ValitaError);
      expectType(t).toImply<{ a: number }>(true);
    });
  });
  describe("check()", () => {
    it("accepts a function returning boolean", () => {
      const t = v.object({ a: v.string() }).check((_v) => true);
      expect(t.parse({ a: "test" })).to.deep.equal({ a: "test" });
    });
    it("doesn't affect the base shape", () => {
      const t = v.object({ a: v.string() }).check((v): boolean => Boolean(v));
      expectType(t).toImply<{ a: string }>(true);
    });
    it("skips all checks if any property fails to parse", () => {
      let didRun = false;
      const t = v.object({ a: v.string(), b: v.number() }).check(() => {
        didRun = true;
        return true;
      });
      expect(() => t.parse({ a: "test" })).to.throw(v.ValitaError);
      expect(didRun).to.be.false;
    });
    it("runs multiple checks in order", () => {
      const t = v
        .object({ a: v.string() })
        .check((v) => v.a === "test", "first")
        .check(() => false, "second");
      expect(() => t.parse({ a: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "second",
        });
      expect(() => t.parse({ a: "other" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "first",
        });
    });
    it("runs checks after the object has otherwise been parsed", () => {
      const t = v
        .object({ a: v.string() })
        .check((v) => (v as Record<string, unknown>).b === 2)
        .extend({ b: v.undefined().map(() => 2) })
        .check((v) => v.b === 2);
      expect(() => t.parse({ a: "test", b: null }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_type",
          path: ["b"],
        });
      expect(t.parse({ a: "test", b: undefined })).to.deep.equal({
        a: "test",
        b: 2,
      });
    });
    it("allows extending the base type after adding checks", () => {
      const t = v
        .object({ a: v.string() })
        .check((v): boolean => Boolean(v))
        .extend({ b: v.number() });
      expect(t.parse({ a: "test", b: 1 })).to.deep.equal({ a: "test", b: 1 });
      expectType(t).toImply<{ a: string; b: number }>(true);
    });
    it("creates a custom error on failure", () => {
      const t = v.object({ a: v.string() }).check(() => false);
      expect(() => t.parse({ a: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.includes({ code: "custom_error" });
    });
    it("allows passing in a custom error message", () => {
      const t = v.object({ a: v.string() }).check(() => false, "test");
      expect(() => t.parse({ a: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: "test",
        });
    });
    it("allows passing in a custom error message in an object", () => {
      const t = v
        .object({ a: v.string() })
        .check(() => false, { message: "test" });
      expect(() => t.parse({ a: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          error: { message: "test" },
        });
    });
    it("allows passing in a error path", () => {
      const t = v
        .object({ a: v.string() })
        .check(() => false, { path: ["test"] });
      expect(() => t.parse({ a: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "custom_error",
          path: ["test"],
        });
    });
  });
});

describe("record()", () => {
  it("acceps empty objects", () => {
    const t = v.record(v.unknown());
    expect(t.parse({})).to.deep.equal({});
    expectType(t).toImply<{ [K: string]: unknown }>(true);
  });
  it("does not accept arrays", () => {
    const t = v.record(v.unknown());
    expect(() => t.parse([])).to.throw(v.ValitaError);
  });
  it("acceps the defined types of values", () => {
    const t = v.record(v.number());
    expect(t.parse({ a: 1 })).to.deep.equal({ a: 1 });
    expectType(t).toImply<{ [K: string]: number }>(true);
  });
  it("rejects values other than the defined type", () => {
    const t = v.record(v.number());
    expect(() => t.parse({ a: "test" })).to.throw(v.ValitaError);
  });
  it("does not react to parsing modes", () => {
    const t = v.record(v.number());
    expect(t.parse({ a: 1 }, { mode: "strict" })).to.deep.equal({ a: 1 });
    expect(() => t.parse({ a: 1, b: "test" }, { mode: "strict" })).to.throw(
      v.ValitaError
    );
    expect(t.parse({ a: 1 }, { mode: "strip" })).to.deep.equal({ a: 1 });
    expect(() => t.parse({ a: 1, b: "test" }, { mode: "strip" })).to.throw(
      v.ValitaError
    );
    expect(() =>
      t.parse({ a: 1, b: "test" }, { mode: "passthrough" })
    ).to.throw(v.ValitaError);
  });
});

describe("literal()", () => {
  it("accepts string literals", () => {
    const t = v.literal("test");
    expect(t.parse("test")).to.equal("test");
  });
  it("accepts number literals", () => {
    const t = v.literal(1);
    expect(t.parse(1)).to.equal(1);
  });
  it("accepts bigint literals", () => {
    const t = v.literal(1n);
    expect(t.parse(1n)).to.equal(1n);
  });
  it("accepts boolean literals", () => {
    const t = v.literal(true);
    expect(t.parse(true)).to.equal(true);
  });
  it("rejects other literals when expecting a string literal", () => {
    const t = v.literal("test");
    expect(() => t.parse("other")).to.throw(v.ValitaError);
    expect(() => t.parse(1)).to.throw(v.ValitaError);
    expect(() => t.parse(1n)).to.throw(v.ValitaError);
    expect(() => t.parse(true)).to.throw(v.ValitaError);
  });
  it("rejects other literals when expecting a numeric literal", () => {
    const t = v.literal(1);
    expect(() => t.parse("test")).to.throw(v.ValitaError);
    expect(() => t.parse(2)).to.throw(v.ValitaError);
    expect(() => t.parse(1n)).to.throw(v.ValitaError);
    expect(() => t.parse(true)).to.throw(v.ValitaError);
  });
  it("rejects other literals when expecting a bigint literal", () => {
    const t = v.literal(1n);
    expect(() => t.parse("test")).to.throw(v.ValitaError);
    expect(() => t.parse(1)).to.throw(v.ValitaError);
    expect(() => t.parse(2n)).to.throw(v.ValitaError);
    expect(() => t.parse(true)).to.throw(v.ValitaError);
  });
  it("rejects other literals when expecting a boolean literal", () => {
    const t = v.literal(true);
    expect(() => t.parse("test")).to.throw(v.ValitaError);
    expect(() => t.parse(1)).to.throw(v.ValitaError);
    expect(() => t.parse(1n)).to.throw(v.ValitaError);
    expect(() => t.parse(false)).to.throw(v.ValitaError);
  });
});

describe("array()", () => {
  it("accepts arrays", () => {
    const t = v.array(v.number());
    expect(t.parse([1])).to.deep.equal([1]);
  });
  it("rejects other types", () => {
    const t = v.array(v.number());
    for (const val of ["1", 1n, true, null, undefined, { 0: 1 }]) {
      expect(() => t.parse(val)).to.throw(v.ValitaError);
    }
  });
  it("throws on item mismatch", () => {
    const t = v.array(v.string());
    expect(() => t.parse([1])).to.throw(v.ValitaError);
  });
  it("returns the original array instance if possible", () => {
    const t = v.array(v.number());
    const a = [1];
    expect(t.parse(a)).to.equal(a);
  });
  it("returns a new array instance if the items change", () => {
    const t = v.array(v.number().map(() => "test"));
    const a = [1];
    expect(t.parse(a)).to.not.equal(a);
  });
  it("infers array", () => {
    const t = v.array(v.number());
    expectType(t).toImply<number[]>(true);
  });
});

describe("tuple()", () => {
  it("accepts arrays", () => {
    const t = v.tuple([v.number(), v.number()]);
    expect(t.parse([1, 1])).to.deep.equal([1, 1]);
  });
  it("rejects non-arrays", () => {
    const t = v.tuple([v.number(), v.number()]);
    expect(() => t.parse(1))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        path: [],
        expected: ["array"],
      });
  });
  it("accepts tuples of different types", () => {
    const t = v.tuple([v.number(), v.string()]);
    expect(t.parse([1, "string"])).to.deep.equal([1, "string"]);
  });
  it("throws on item mismatch", () => {
    const t = v.tuple([v.number(), v.string()]);
    expect(() => t.parse([1, 1]))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        path: [1],
        expected: ["string"],
      });
  });
  it("throws on length mismatch", () => {
    const t = v.tuple([v.number()]);
    expect(() => t.parse([1, 1]))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_length",
        path: [],
        minLength: 1,
        maxLength: 1,
      });
  });
  it("infers tuple", () => {
    const t = v.tuple([v.number(), v.string()]);
    expectType(t).toImply<[number, string]>(true);
  });
  it("returns the original array instance if possible", () => {
    const t = v.tuple([v.number(), v.number()]);
    const a = [1, 2];
    expect(t.parse(a)).to.equal(a);
  });
  it("returns a new array instance if the items change", () => {
    const t = v.tuple([v.number().map(() => "test"), v.number()]);
    const a = [1, 2];
    expect(t.parse(a)).to.not.equal(a);
  });
});

describe("union()", () => {
  it("accepts two subvalidators", () => {
    const t = v.union(v.string(), v.number());
    expect(t.parse("test")).to.equal("test");
    expect(t.parse(1)).to.equal(1);
    expect(() => t.parse({})).to.throw(v.ValitaError);
  });
  it("ignores never()", () => {
    const t = v.union(v.string(), v.never());
    expect(t.parse("test")).to.equal("test");
    expect(() => t.parse(1)).to.throw(v.ValitaError);
    expectType(t).toImply<string>(true);
  });
  it("is optional if any argument is optional", () => {
    const t = v.object({
      a: v.union(v.string().optional(), v.number()),
    });
    expectType(t).toImply<{ a?: string | number | undefined }>(true);
  });
  it("picks the first successful parse", () => {
    const t = v.union(
      v
        .string()
        .map(() => 1)
        .assert(() => false),
      v.string().map(() => 2)
    );
    expect(t.parse("test")).to.equal(2);
  });
  it("respects the order of overlapping parsers", () => {
    const a = v.literal(1).map(() => "literal");
    const b = v.number().map(() => "number");
    const c = v.unknown().map(() => "unknown");
    const u = v.union;
    expect(u(a, b, c).parse(1)).to.equal("literal");
    expect(u(a, c, b).parse(1)).to.equal("literal");
    expect(u(b, a, c).parse(1)).to.equal("number");
    expect(u(b, c, a).parse(1)).to.equal("number");
    expect(u(c, b, a).parse(1)).to.equal("unknown");
    expect(u(c, a, b).parse(1)).to.equal("unknown");
  });
  it("deduplicates strictly equal parsers", () => {
    const a = v.unknown().assert(() => false, "test");
    expect(() => v.union(a, a).parse(1))
      .to.throw(v.ValitaError)
      .with.property("issues")
      .with.lengthOf(1);
  });
  it("keeps the matching order when deduplicating", () => {
    const a = v.unknown().map(() => "a");
    const b = v.unknown().map(() => "b");
    expect(v.union(a, b, a).parse(1)).to.equal("a");
  });
  it("accepts more than two subvalidators", () => {
    const t = v.union(
      v.string(),
      v.number(),
      v.null(),
      v.undefined(),
      v.boolean()
    );
    expect(t.parse("test")).to.equal("test");
    expect(t.parse(1)).to.equal(1);
    expect(t.parse(null)).to.equal(null);
    expect(t.parse(undefined)).to.equal(undefined);
    expect(t.parse(true)).to.equal(true);
    expect(() => t.parse({})).to.throw(v.ValitaError);
  });
  it("reports the expected type even for literals when the base type doesn't match", () => {
    const t = v.union(v.literal(1), v.literal("test"));
    expect(() => t.parse(true))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        expected: ["number", "string"],
      });
  });
  it("reports the expected literals when the base type matches", () => {
    const t = v.union(v.literal(1), v.literal("test"));
    expect(() => t.parse(2))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_literal",
        expected: [1, "test"],
      });
  });
  it("reports the errors from a branch that doesn't overlap with any other branch", () => {
    const t = v.union(v.literal(1), v.number(), v.object({ a: v.number() }));
    expect(() => t.parse({ a: "test" }))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        path: ["a"],
        expected: ["number"],
      });
  });
  it("matches unknowns if nothing else matches", () => {
    const t = v.union(
      v.literal(1),
      v.literal(2),
      v.unknown().assert(() => false, "test")
    );
    expect(() => t.parse({ a: 1 }))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "custom_error",
        error: "test",
      });
  });
  it("considers never() to not overlap with anything", () => {
    const t = v.union(
      v.never(),
      v.unknown().assert(() => false, "unknown")
    );
    expect(() => t.parse(2))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "custom_error",
        error: "unknown",
      });
  });
  it("considers unknown() to overlap with everything except never()", () => {
    const t = v.union(
      v.literal(1),
      v.literal(2).assert(() => false),
      v.unknown().assert(() => false)
    );
    expect(() => t.parse(2))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_union",
      });
  });
  it("considers unknown() to overlap with objects", () => {
    const t = v.union(
      v.unknown(),
      v.object({ type: v.literal("a") }),
      v.object({ type: v.literal("b") })
    );
    expect(t.parse({ type: "c" })).to.deep.equal({ type: "c" });
  });
  it("considers array() and tuple() to overlap", () => {
    const t = v.union(v.array(v.number()), v.tuple([v.string()]));
    expect(() => t.parse(2))
      .to.throw(v.ValitaError)
      .with.nested.property("issues[0]")
      .that.deep.includes({
        code: "invalid_type",
        expected: ["array"],
      });
  });
  describe("of objects", () => {
    it("discriminates based on base types", () => {
      const t = v.union(
        v.object({ type: v.number() }),
        v.object({ type: v.string() })
      );
      expect(() => t.parse({ type: true }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_type",
          path: ["type"],
          expected: ["number", "string"],
        });
    });
    it("discriminates based on literal values", () => {
      const t = v.union(
        v.object({ type: v.literal(1) }),
        v.object({ type: v.literal(2) })
      );
      expect(() => t.parse({ type: 3 }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_literal",
          path: ["type"],
          expected: [1, 2],
        });
    });
    it("reports expected types in the order they were first listed", () => {
      const t1 = v.union(v.literal(2), v.string(), v.literal(2));
      expect(() => t1.parse(true))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_type",
          path: [],
          expected: ["number", "string"],
        });

      const t2 = v.union(v.string(), v.literal(2), v.string());
      expect(() => t2.parse(true))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_type",
          path: [],
          expected: ["string", "number"],
        });
    });
    it("reports expected literals in the order they were first listed", () => {
      const t1 = v.union(v.literal(2), v.literal(1), v.literal(2));
      expect(() => t1.parse(3))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_literal",
          path: [],
          expected: [2, 1],
        });

      const t2 = v.union(v.literal(1), v.literal(2), v.literal(1));
      expect(() => t2.parse(3))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_literal",
          path: [],
          expected: [1, 2],
        });
    });
    it("discriminates based on mixture of base types and literal values", () => {
      const t = v.union(
        v.object({ type: v.literal(1) }),
        v.object({ type: v.string() })
      );
      expect(() => t.parse({ type: true }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_type",
          path: ["type"],
          expected: ["number", "string"],
        });
    });
    it("considers unknown() to overlap with everything except never()", () => {
      const t = v.union(
        v.object({ type: v.literal(1) }),
        v.object({ type: v.unknown().assert(() => false) })
      );
      expect(() => t.parse({ type: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({ code: "invalid_union" });
    });
    it("considers literals to overlap with their base types", () => {
      const t = v.union(
        v.object({ type: v.literal(1) }),
        v.object({ type: v.number() })
      );
      expect(() => t.parse({ type: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({ code: "invalid_union" });
    });
    it("considers equal literals to overlap", () => {
      const t = v.union(
        v.object({ type: v.literal(1) }),
        v.object({ type: v.literal(1) })
      );
      expect(() => t.parse({ type: "test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({ code: "invalid_union" });
    });
    it("folds multiple overlapping types together in same branch", () => {
      const t = v.union(
        v.object({
          type: v.union(v.string(), v.union(v.string(), v.literal("test"))),
        }),
        v.object({
          type: v.union(v.literal(2).optional().optional(), v.undefined()),
          other: v.literal("test"),
        })
      );
      expect(() => t.parse({ type: 2, other: "not_test" }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0]")
        .that.deep.includes({
          code: "invalid_literal",
          path: ["other"],
          expected: ["test"],
        });
    });
    it("considers two optionals to overlap", () => {
      const t = v.union(
        v.object({ type: v.literal(1).optional() }),
        v.object({ type: v.literal(2).optional() })
      );
      expect(() => t.parse({ type: 3 }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0].code", "invalid_union");
    });
    it("considers two optionals and undefineds to overlap", () => {
      const t = v.union(
        v.object({ type: v.undefined() }),
        v.object({ type: v.literal(2).optional() })
      );
      expect(() => t.parse({ type: 3 }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0].code", "invalid_union");
    });
    it("considers two unions with partially same types to overlap", () => {
      const t = v.union(
        v.object({ type: v.union(v.literal(1), v.literal(2)) }),
        v.object({ type: v.union(v.literal(2), v.literal(3)) })
      );
      expect(() => t.parse({ type: 4 }))
        .to.throw(v.ValitaError)
        .with.nested.property("issues[0].code", "invalid_union");
    });
  });
});

describe("ok()", () => {
  it("infers literals when possible", () => {
    const t = v.number().chain(() => v.ok("test"));
    expectType(t).toImply<"test">(true);
  });
});

describe("ValitaError", () => {
  const error = new v.ValitaError({
    code: "invalid_type",
    expected: ["bigint"],
  });
  it("is derived from Error", () => {
    expect(error).to.be.instanceof(Error);
  });
  it("has a name", () => {
    expect(error.name).to.equal("ValitaError");
  });
  describe("issues", () => {
    it("lists issues", () => {
      expect(error.issues).to.deep.equal([
        {
          path: [],
          code: "invalid_type",
          expected: ["bigint"],
        },
      ]);
    });
    it("supports multiple issues", () => {
      const error = new v.ValitaError({
        code: "join",
        left: {
          code: "invalid_type",
          expected: ["bigint"],
        },
        right: {
          code: "prepend",
          key: "first",
          tree: {
            code: "invalid_type",
            expected: ["string"],
          },
        },
      });
      expect(error.issues).to.deep.equal([
        {
          path: [],
          code: "invalid_type",
          expected: ["bigint"],
        },
        {
          path: ["first"],
          code: "invalid_type",
          expected: ["string"],
        },
      ]);
    });
    it("caches the issues list", () => {
      expect(error.issues).to.equal(error.issues);
    });
  });
  describe("message", () => {
    it("describes the issue when there's only one issue", () => {
      expect(error.message).to.equal("invalid_type at . (expected bigint)");
    });
    it("describes the leftmost issue when there are two issues", () => {
      const error = new v.ValitaError({
        code: "join",
        left: {
          code: "invalid_type",
          expected: ["bigint"],
        },
        right: {
          code: "prepend",
          key: "first",
          tree: {
            code: "invalid_type",
            expected: ["string"],
          },
        },
      });
      expect(error.message).to.equal(
        "invalid_type at . (expected bigint) (+ 1 other issue)"
      );
    });
    it("describes the leftmost issue when there are more than two issues", () => {
      const error = new v.ValitaError({
        code: "join",
        left: {
          code: "invalid_type",
          expected: ["bigint"],
        },
        right: {
          code: "join",
          left: {
            code: "invalid_type",
            expected: ["bigint"],
          },
          right: {
            code: "prepend",
            key: "first",
            tree: {
              code: "invalid_type",
              expected: ["string"],
            },
          },
        },
      });
      expect(error.message).to.equal(
        "invalid_type at . (expected bigint) (+ 2 other issues)"
      );
    });
  });
});
