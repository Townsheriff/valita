function _collectIssues(tree, path, issues) {
    var _a;
    if (tree.code === "join") {
        _collectIssues(tree.left, path, issues);
        _collectIssues(tree.right, path, issues);
    }
    else if (tree.code === "prepend") {
        path.push(tree.key);
        _collectIssues(tree.tree, path, issues);
        path.pop();
    }
    else {
        const finalPath = path.slice();
        if (tree.path) {
            finalPath.push(...tree.path);
        }
        if (tree.code === "custom_error" &&
            typeof tree.error !== "string" &&
            ((_a = tree.error) === null || _a === void 0 ? void 0 : _a.path)) {
            finalPath.push(...tree.error.path);
        }
        issues.push({ ...tree, path: finalPath });
    }
}
function collectIssues(tree) {
    const issues = [];
    const path = [];
    _collectIssues(tree, path, issues);
    return issues;
}
function orList(list) {
    if (list.length === 0) {
        return "nothing";
    }
    const last = list[list.length - 1];
    if (list.length < 2) {
        return last;
    }
    return `${list.slice(0, -1).join(", ")} or ${last}`;
}
function formatLiteral(value) {
    return typeof value === "bigint" ? `${value}n` : JSON.stringify(value);
}
function findOneIssue(tree, path = []) {
    var _a;
    if (tree.code === "join") {
        return findOneIssue(tree.left, path);
    }
    else if (tree.code === "prepend") {
        path.push(tree.key);
        return findOneIssue(tree.tree, path);
    }
    else {
        if (tree.path) {
            path.push(...tree.path);
        }
        if (tree.code === "custom_error" &&
            typeof tree.error !== "string" &&
            ((_a = tree.error) === null || _a === void 0 ? void 0 : _a.path)) {
            path.push(...tree.error.path);
        }
        return { ...tree, path };
    }
}
function countIssues(tree) {
    if (tree.code === "join") {
        return countIssues(tree.left) + countIssues(tree.right);
    }
    else if (tree.code === "prepend") {
        return countIssues(tree.tree);
    }
    else {
        return 1;
    }
}
function formatIssueTree(issueTree) {
    const count = countIssues(issueTree);
    const issue = findOneIssue(issueTree);
    const path = issue.path || [];
    let message = "validation failed";
    if (issue.code === "invalid_type") {
        message = `expected ${orList(issue.expected)}`;
    }
    else if (issue.code === "invalid_literal") {
        message = `expected ${orList(issue.expected.map(formatLiteral))}`;
    }
    else if (issue.code === "missing_key") {
        message = `missing key ${formatLiteral(issue.key)}`;
    }
    else if (issue.code === "unrecognized_key") {
        message = `unrecognized key ${formatLiteral(issue.key)}`;
    }
    else if (issue.code === "invalid_length") {
        const min = issue.minLength;
        const max = issue.maxLength;
        message = `expected an array with `;
        if (min > 0) {
            if (max === min) {
                message += `${min}`;
            }
            else if (max < Infinity) {
                message += `between ${min} and ${max}`;
            }
            else {
                message += `at least ${min}`;
            }
        }
        else {
            message += `at most ${max}`;
        }
        message += ` item(s)`;
    }
    else if (issue.code === "custom_error") {
        const error = issue.error;
        if (typeof error === "string") {
            message = error;
        }
        else if (error && error.message === "string") {
            message = error.message;
        }
    }
    let msg = `${issue.code} at .${path.join(".")} (${message})`;
    if (count === 2) {
        msg += ` (+ 1 other issue)`;
    }
    else if (count > 2) {
        msg += ` (+ ${count - 1} other issues)`;
    }
    return msg;
}
class ValitaFailure {
    constructor(issueTree) {
        this.issueTree = issueTree;
        this.ok = false;
    }
    get issues() {
        const issues = collectIssues(this.issueTree);
        Object.defineProperty(this, "issues", {
            value: issues,
            writable: false,
        });
        return issues;
    }
    get message() {
        const message = formatIssueTree(this.issueTree);
        Object.defineProperty(this, "message", {
            value: message,
            writable: false,
        });
        return message;
    }
    throw() {
        throw new ValitaError(this.issueTree);
    }
}
export class ValitaError extends Error {
    constructor(issueTree) {
        super(formatIssueTree(issueTree));
        this.issueTree = issueTree;
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = new.target.name;
    }
    get issues() {
        const issues = collectIssues(this.issueTree);
        Object.defineProperty(this, "issues", {
            value: issues,
            writable: false,
        });
        return issues;
    }
}
function joinIssues(left, right) {
    return left ? { code: "join", left, right } : right;
}
function prependPath(key, tree) {
    return { code: "prepend", key, tree };
}
function isObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function toTerminals(type) {
    const result = [];
    type.toTerminals(result);
    return result;
}
function hasTerminal(type, name) {
    return toTerminals(type).some((t) => t.name === name);
}
const Nothing = Symbol();
var FuncMode;
(function (FuncMode) {
    FuncMode[FuncMode["PASS"] = 0] = "PASS";
    FuncMode[FuncMode["STRICT"] = 1] = "STRICT";
    FuncMode[FuncMode["STRIP"] = 2] = "STRIP";
})(FuncMode || (FuncMode = {}));
function ok(value) {
    return { ok: true, value };
}
function err(error) {
    return { ok: false, error };
}
class AbstractType {
    get func() {
        const f = this.genFunc();
        Object.defineProperty(this, "func", {
            value: f,
            writable: false,
        });
        return f;
    }
    parse(v, options) {
        let mode = FuncMode.PASS;
        if (options && options.mode === "strict") {
            mode = FuncMode.STRICT;
        }
        else if (options && options.mode === "strip") {
            mode = FuncMode.STRIP;
        }
        const r = this.func(v, mode);
        if (r === true) {
            return v;
        }
        else if (r.code === "ok") {
            return r.value;
        }
        else {
            throw new ValitaError(r);
        }
    }
    try(v, options) {
        let mode = FuncMode.PASS;
        if (options && options.mode === "strict") {
            mode = FuncMode.STRICT;
        }
        else if (options && options.mode === "strip") {
            mode = FuncMode.STRIP;
        }
        const r = this.func(v, mode);
        if (r === true) {
            return { ok: true, value: v };
        }
        else if (r.code === "ok") {
            return { ok: true, value: r.value };
        }
        else {
            return new ValitaFailure(r);
        }
    }
    optional() {
        return new Optional(this);
    }
    default(defaultValue) {
        return new DefaultType(this, defaultValue);
    }
    assert(func, error) {
        const err = { code: "custom_error", error };
        return new TransformType(this, (v) => (func(v) ? true : err));
    }
    map(func) {
        return new TransformType(this, (v) => ({
            code: "ok",
            value: func(v),
        }));
    }
    chain(func) {
        return new TransformType(this, (v) => {
            const r = func(v);
            if (r.ok) {
                return { code: "ok", value: r.value };
            }
            else {
                return { code: "custom_error", error: r.error };
            }
        });
    }
}
class Type extends AbstractType {
}
class Optional extends AbstractType {
    constructor(type) {
        super();
        this.type = type;
        this.name = "optional";
    }
    genFunc() {
        const func = this.type.func;
        return (v, mode) => {
            return v === undefined || v === Nothing ? true : func(v, mode);
        };
    }
    toTerminals(into) {
        into.push(this);
        into.push(new UndefinedType());
        this.type.toTerminals(into);
    }
}
class DefaultType extends Type {
    constructor(type, defaultValue) {
        super();
        this.type = type;
        this.defaultValue = defaultValue;
        this.name = "default";
    }
    genFunc() {
        const func = this.type.func;
        const undefinedOutput = this.defaultValue === undefined
            ? true
            : { code: "ok", value: this.defaultValue };
        const nothingOutput = {
            code: "ok",
            value: this.defaultValue,
        };
        return (v, mode) => {
            if (v === undefined) {
                return undefinedOutput;
            }
            else if (v === Nothing) {
                return nothingOutput;
            }
            else {
                const result = func(v, mode);
                if (result !== true &&
                    result.code === "ok" &&
                    result.value === undefined) {
                    return nothingOutput;
                }
                return result;
            }
        };
    }
    toTerminals(into) {
        into.push(this.type.optional());
        this.type.toTerminals(into);
    }
}
class ObjectType extends Type {
    constructor(shape, restType, checks) {
        super();
        this.shape = shape;
        this.restType = restType;
        this.checks = checks;
        this.name = "object";
    }
    toTerminals(into) {
        into.push(this);
    }
    check(func, error) {
        var _a;
        const issue = { code: "custom_error", error };
        return new ObjectType(this.shape, this.restType, [
            ...((_a = this.checks) !== null && _a !== void 0 ? _a : []),
            {
                func: func,
                issue,
            },
        ]);
    }
    genFunc() {
        const shape = this.shape;
        const rest = this.restType ? this.restType.func : undefined;
        const invalidType = { code: "invalid_type", expected: ["object"] };
        const checks = this.checks;
        const required = [];
        const optional = [];
        const knownKeys = Object.create(null);
        for (const key in shape) {
            if (hasTerminal(shape[key], "optional")) {
                optional.push(key);
            }
            else {
                required.push(key);
            }
            knownKeys[key] = true;
        }
        const keys = [...required, ...optional];
        const funcs = keys.map((key) => shape[key].func);
        const requiredCount = required.length;
        return (obj, mode) => {
            if (!isObject(obj)) {
                return invalidType;
            }
            const strict = mode === FuncMode.STRICT;
            const strip = mode === FuncMode.STRIP;
            let issueTree = undefined;
            let output = obj;
            let setKeys = false;
            let copied = false;
            if (strict || strip || rest) {
                for (const key in obj) {
                    if (!Object.prototype.hasOwnProperty.call(knownKeys, key)) {
                        if (rest) {
                            const r = rest(obj[key], mode);
                            if (r !== true) {
                                if (r.code !== "ok") {
                                    issueTree = joinIssues(issueTree, prependPath(key, r));
                                }
                                else if (!issueTree) {
                                    if (!copied) {
                                        output = { ...obj };
                                        copied = true;
                                    }
                                    output[key] = r.value;
                                }
                            }
                        }
                        else if (strict) {
                            return { code: "unrecognized_key", key };
                        }
                        else if (strip) {
                            output = {};
                            setKeys = true;
                            copied = true;
                            break;
                        }
                    }
                }
            }
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                let value = obj[key];
                let found = true;
                if (value === undefined && !(key in obj)) {
                    if (i < requiredCount) {
                        return { code: "missing_key", key };
                    }
                    value = Nothing;
                    found = false;
                }
                const r = funcs[i](value, mode);
                if (r === true) {
                    if (setKeys && found) {
                        output[key] = value;
                    }
                }
                else if (r.code !== "ok") {
                    issueTree = joinIssues(issueTree, prependPath(key, r));
                }
                else if (!issueTree) {
                    if (!copied) {
                        output = { ...obj };
                        copied = true;
                    }
                    output[key] = r.value;
                }
            }
            if (checks && !issueTree) {
                for (let i = 0; i < checks.length; i++) {
                    if (!checks[i].func(output)) {
                        return checks[i].issue;
                    }
                }
            }
            return (issueTree ||
                (copied
                    ? { code: "ok", value: output }
                    : true));
        };
    }
    rest(restType) {
        return new ObjectType(this.shape, restType);
    }
    extend(shape) {
        return new ObjectType({ ...this.shape, ...shape }, this.restType);
    }
    pick(...keys) {
        const shape = {};
        keys.forEach((key) => {
            shape[key] = this.shape[key];
        });
        return new ObjectType(shape, undefined);
    }
    omit(...keys) {
        const shape = { ...this.shape };
        keys.forEach((key) => {
            delete shape[key];
        });
        return new ObjectType(shape, this.restType);
    }
    partial() {
        var _a;
        const shape = {};
        Object.keys(this.shape).forEach((key) => {
            shape[key] = this.shape[key].optional();
        });
        const rest = (_a = this.restType) === null || _a === void 0 ? void 0 : _a.optional();
        return new ObjectType(shape, rest);
    }
}
class ArrayType extends Type {
    constructor(head, rest) {
        super();
        this.head = head;
        this.rest = rest;
        this.name = "array";
    }
    toTerminals(into) {
        into.push(this);
    }
    genFunc() {
        var _a;
        const headFuncs = this.head.map((t) => t.func);
        const restFunc = ((_a = this.rest) !== null && _a !== void 0 ? _a : never()).func;
        const minLength = headFuncs.length;
        const maxLength = this.rest ? Infinity : minLength;
        const invalidType = { code: "invalid_type", expected: ["array"] };
        const invalidLength = {
            code: "invalid_length",
            minLength,
            maxLength,
        };
        return (arr, mode) => {
            if (!Array.isArray(arr)) {
                return invalidType;
            }
            const length = arr.length;
            if (length < minLength || length > maxLength) {
                return invalidLength;
            }
            let issueTree = undefined;
            let output = arr;
            for (let i = 0; i < arr.length; i++) {
                const func = i < minLength ? headFuncs[i] : restFunc;
                const r = func(arr[i], mode);
                if (r !== true) {
                    if (r.code === "ok") {
                        if (output === arr) {
                            output = arr.slice();
                        }
                        output[i] = r.value;
                    }
                    else {
                        issueTree = joinIssues(issueTree, prependPath(i, r));
                    }
                }
            }
            if (issueTree) {
                return issueTree;
            }
            else if (arr === output) {
                return true;
            }
            else {
                return { code: "ok", value: output };
            }
        };
    }
}
function toBaseType(v) {
    const type = typeof v;
    if (type !== "object") {
        return type;
    }
    else if (v === null) {
        return "null";
    }
    else if (Array.isArray(v)) {
        return "array";
    }
    else {
        return type;
    }
}
function dedup(arr) {
    const output = [];
    const seen = new Set();
    for (let i = 0; i < arr.length; i++) {
        if (!seen.has(arr[i])) {
            output.push(arr[i]);
            seen.add(arr[i]);
        }
    }
    return output;
}
function findCommonKeys(rs) {
    const map = new Map();
    rs.forEach((r) => {
        for (const key in r) {
            map.set(key, (map.get(key) || 0) + 1);
        }
    });
    const result = [];
    map.forEach((count, key) => {
        if (count === rs.length) {
            result.push(key);
        }
    });
    return result;
}
function createObjectMatchers(t) {
    const objects = [];
    t.forEach(({ root, terminal }) => {
        if (terminal.name === "object") {
            objects.push({ root, terminal });
        }
    });
    const shapes = objects.map(({ terminal }) => terminal.shape);
    const common = findCommonKeys(shapes);
    const discriminants = common.filter((key) => {
        const types = new Map();
        const literals = new Map();
        let optionals = [];
        let unknowns = [];
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            const terminals = toTerminals(shape[key]);
            for (let j = 0; j < terminals.length; j++) {
                const terminal = terminals[j];
                if (terminal.name === "never") {
                    // skip
                }
                else if (terminal.name === "unknown") {
                    unknowns.push(i);
                }
                else if (terminal.name === "optional") {
                    optionals.push(i);
                }
                else if (terminal.name === "literal") {
                    const options = literals.get(terminal.value) || [];
                    options.push(i);
                    literals.set(terminal.value, options);
                }
                else {
                    const options = types.get(terminal.name) || [];
                    options.push(i);
                    types.set(terminal.name, options);
                }
            }
        }
        optionals = dedup(optionals);
        if (optionals.length > 1) {
            return false;
        }
        unknowns = dedup(unknowns);
        if (unknowns.length > 1) {
            return false;
        }
        literals.forEach((found, value) => {
            const options = types.get(toBaseType(value));
            if (options) {
                options.push(...found);
                literals.delete(value);
            }
        });
        let success = true;
        literals.forEach((found) => {
            if (dedup(found.concat(unknowns)).length > 1) {
                success = false;
            }
        });
        types.forEach((found) => {
            if (dedup(found.concat(unknowns)).length > 1) {
                success = false;
            }
        });
        return success;
    });
    return discriminants.map((key) => {
        const flattened = flatten(objects.map(({ root, terminal }) => ({
            root,
            type: terminal.shape[key],
        })));
        let optional = undefined;
        for (let i = 0; i < flattened.length; i++) {
            const { root, terminal } = flattened[i];
            if (terminal.name === "optional") {
                optional = root;
                break;
            }
        }
        return {
            key,
            optional,
            matcher: createUnionMatcher(flattened, [key]),
        };
    });
}
function createUnionMatcher(t, path) {
    const order = new Map();
    t.forEach(({ root }, i) => {
        var _a;
        order.set(root, (_a = order.get(root)) !== null && _a !== void 0 ? _a : i);
    });
    const byOrder = (a, b) => {
        var _a, _b;
        return ((_a = order.get(a)) !== null && _a !== void 0 ? _a : 0) - ((_b = order.get(b)) !== null && _b !== void 0 ? _b : 0);
    };
    const expectedTypes = [];
    const literals = new Map();
    const types = new Map();
    let unknowns = [];
    let optionals = [];
    t.forEach(({ root, terminal }) => {
        if (terminal.name === "never") {
            // skip
        }
        else if (terminal.name === "optional") {
            optionals.push(root);
        }
        else if (terminal.name === "unknown") {
            unknowns.push(root);
        }
        else if (terminal.name === "literal") {
            const roots = literals.get(terminal.value) || [];
            roots.push(root);
            literals.set(terminal.value, roots);
            expectedTypes.push(toBaseType(terminal.value));
        }
        else {
            const roots = types.get(terminal.name) || [];
            roots.push(root);
            types.set(terminal.name, roots);
            expectedTypes.push(terminal.name);
        }
    });
    literals.forEach((roots, value) => {
        const options = types.get(toBaseType(value));
        if (options) {
            options.push(...roots);
            literals.delete(value);
        }
    });
    unknowns = dedup(unknowns).sort(byOrder);
    optionals = dedup(optionals).sort(byOrder);
    types.forEach((roots, type) => types.set(type, dedup(roots.concat(unknowns).sort(byOrder))));
    literals.forEach((roots, value) => literals.set(value, dedup(roots.concat(unknowns)).sort(byOrder)));
    const expectedLiterals = [];
    literals.forEach((_, value) => {
        expectedLiterals.push(value);
    });
    const invalidType = {
        code: "invalid_type",
        path,
        expected: dedup(expectedTypes),
    };
    const invalidLiteral = {
        code: "invalid_literal",
        path,
        expected: expectedLiterals,
    };
    const literalTypes = new Set(expectedLiterals.map(toBaseType));
    return (rootValue, value, mode) => {
        let count = 0;
        let issueTree;
        if (value === Nothing) {
            for (let i = 0; i < optionals.length; i++) {
                const r = optionals[i].func(rootValue, mode);
                if (r === true || r.code === "ok") {
                    return r;
                }
                issueTree = joinIssues(issueTree, r);
                count++;
            }
            if (!issueTree) {
                return invalidType;
            }
            else if (count > 1) {
                return { code: "invalid_union", tree: issueTree };
            }
            else {
                return issueTree;
            }
        }
        const type = toBaseType(value);
        const options = literals.get(value) || types.get(type) || unknowns;
        for (let i = 0; i < options.length; i++) {
            const r = options[i].func(rootValue, mode);
            if (r === true || r.code === "ok") {
                return r;
            }
            issueTree = joinIssues(issueTree, r);
            count++;
        }
        if (!issueTree) {
            return literalTypes.has(type) ? invalidLiteral : invalidType;
        }
        else if (count > 1) {
            return { code: "invalid_union", tree: issueTree };
        }
        else {
            return issueTree;
        }
    };
}
function flatten(t) {
    const result = [];
    t.forEach(({ root, type }) => toTerminals(type).forEach((terminal) => {
        result.push({ root, terminal });
    }));
    return result;
}
class UnionType extends Type {
    constructor(options) {
        super();
        this.options = options;
        this.name = "union";
    }
    toTerminals(into) {
        this.options.forEach((o) => o.toTerminals(into));
    }
    genFunc() {
        const flattened = flatten(this.options.map((root) => ({ root, type: root })));
        const hasUnknown = hasTerminal(this, "unknown");
        const objects = createObjectMatchers(flattened);
        const base = createUnionMatcher(flattened);
        return (v, mode) => {
            if (!hasUnknown && objects.length > 0 && isObject(v)) {
                const item = objects[0];
                const value = v[item.key];
                if (value === undefined && !(item.key in v)) {
                    if (item.optional) {
                        return item.optional.func(Nothing, mode);
                    }
                    return { code: "missing_key", key: item.key };
                }
                return item.matcher(v, value, mode);
            }
            return base(v, v, mode);
        };
    }
    optional() {
        return new Optional(this);
    }
}
class NeverType extends Type {
    constructor() {
        super(...arguments);
        this.name = "never";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: [] };
        return (v, _mode) => (v === Nothing ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class UnknownType extends Type {
    constructor() {
        super(...arguments);
        this.name = "unknown";
    }
    genFunc() {
        return (_v, _mode) => true;
    }
    toTerminals(into) {
        into.push(this);
    }
}
class NumberType extends Type {
    constructor() {
        super(...arguments);
        this.name = "number";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: ["number"] };
        return (v, _mode) => (typeof v === "number" ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class StringType extends Type {
    constructor() {
        super(...arguments);
        this.name = "string";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: ["string"] };
        return (v, _mode) => (typeof v === "string" ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class Scalar extends Type {
    constructor() {
        super(...arguments);
        this.name = "scalar";
    }
    genFunc() {
        return (_, _mode) => true;
    }
    toTerminals(into) {
        into.push(this);
    }
}
class BigIntType extends Type {
    constructor() {
        super(...arguments);
        this.name = "bigint";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: ["bigint"] };
        return (v, _mode) => (typeof v === "bigint" ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class BooleanType extends Type {
    constructor() {
        super(...arguments);
        this.name = "boolean";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: ["boolean"] };
        return (v, _mode) => (typeof v === "boolean" ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class UndefinedType extends Type {
    constructor() {
        super(...arguments);
        this.name = "undefined";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: ["undefined"] };
        return (v, _mode) => (v === undefined ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class NullType extends Type {
    constructor() {
        super(...arguments);
        this.name = "null";
    }
    genFunc() {
        const issue = { code: "invalid_type", expected: ["null"] };
        return (v, _mode) => (v === null ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class LiteralType extends Type {
    constructor(value) {
        super();
        this.value = value;
        this.name = "literal";
    }
    genFunc() {
        const value = this.value;
        const issue = { code: "invalid_literal", expected: [value] };
        return (v, _) => (v === value ? true : issue);
    }
    toTerminals(into) {
        into.push(this);
    }
}
class TransformType extends Type {
    constructor(transformed, transform) {
        super();
        this.transformed = transformed;
        this.transform = transform;
        this.name = "transform";
    }
    genFunc() {
        const chain = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let next = this;
        while (next instanceof TransformType) {
            chain.push(next.transform);
            next = next.transformed;
        }
        chain.reverse();
        const func = next.func;
        const undef = { code: "ok", value: undefined };
        return (v, mode) => {
            let result = func(v, mode);
            if (result !== true && result.code !== "ok") {
                return result;
            }
            let current;
            if (result !== true) {
                current = result.value;
            }
            else if (v === Nothing) {
                current = undefined;
                result = undef;
            }
            else {
                current = v;
            }
            for (let i = 0; i < chain.length; i++) {
                const r = chain[i](current, mode);
                if (r !== true) {
                    if (r.code !== "ok") {
                        return r;
                    }
                    current = r.value;
                    result = r;
                }
            }
            return result;
        };
    }
    toTerminals(into) {
        this.transformed.toTerminals(into);
    }
}
class LazyType extends Type {
    constructor(definer) {
        super();
        this.definer = definer;
        this.name = "lazy";
    }
    get type() {
        const type = this.definer();
        Object.defineProperty(this, "type", {
            value: type,
            writable: false,
        });
        return type;
    }
    genFunc() {
        return this.type.genFunc();
    }
    toTerminals(into) {
        this.type.toTerminals(into);
    }
}
function never() {
    return new NeverType();
}
function unknown() {
    return new UnknownType();
}
function number() {
    return new NumberType();
}
function bigint() {
    return new BigIntType();
}
function string() {
    return new StringType();
}
function scalar() {
    return new Scalar();
}
function boolean() {
    return new BooleanType();
}
function undefined_() {
    return new UndefinedType();
}
function null_() {
    return new NullType();
}
function literal(value) {
    return new LiteralType(value);
}
function object(obj) {
    return new ObjectType(obj, undefined);
}
function record(valueType) {
    return new ObjectType({}, valueType);
}
function array(item) {
    return new ArrayType([], item);
}
function tuple(items) {
    return new ArrayType(items);
}
function union(...options) {
    return new UnionType(options);
}
function lazy(definer) {
    return new LazyType(definer);
}
export { never, unknown, number, bigint, string, boolean, object, record, array, tuple, literal, union, null_ as null, undefined_ as undefined, scalar, lazy, ok, err, };
//# sourceMappingURL=index.js.map