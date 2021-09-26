import { __assign, __extends, __spreadArray } from "tslib";
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
        var finalPath = path.slice();
        if (tree.path) {
            finalPath.push.apply(finalPath, tree.path);
        }
        if (tree.code === "custom_error" &&
            typeof tree.error !== "string" &&
            ((_a = tree.error) === null || _a === void 0 ? void 0 : _a.path)) {
            finalPath.push.apply(finalPath, tree.error.path);
        }
        issues.push(__assign(__assign({}, tree), { path: finalPath }));
    }
}
function collectIssues(tree) {
    var issues = [];
    var path = [];
    _collectIssues(tree, path, issues);
    return issues;
}
function orList(list) {
    if (list.length === 0) {
        return "nothing";
    }
    var last = list[list.length - 1];
    if (list.length < 2) {
        return last;
    }
    return list.slice(0, -1).join(", ") + " or " + last;
}
function formatLiteral(value) {
    return typeof value === "bigint" ? value + "n" : JSON.stringify(value);
}
function findOneIssue(tree, path) {
    var _a;
    if (path === void 0) { path = []; }
    if (tree.code === "join") {
        return findOneIssue(tree.left, path);
    }
    else if (tree.code === "prepend") {
        path.push(tree.key);
        return findOneIssue(tree.tree, path);
    }
    else {
        if (tree.path) {
            path.push.apply(path, tree.path);
        }
        if (tree.code === "custom_error" &&
            typeof tree.error !== "string" &&
            ((_a = tree.error) === null || _a === void 0 ? void 0 : _a.path)) {
            path.push.apply(path, tree.error.path);
        }
        return __assign(__assign({}, tree), { path: path });
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
    var count = countIssues(issueTree);
    var issue = findOneIssue(issueTree);
    var path = issue.path || [];
    var message = "validation failed";
    if (issue.code === "invalid_type") {
        message = "expected " + orList(issue.expected);
    }
    else if (issue.code === "invalid_literal") {
        message = "expected " + orList(issue.expected.map(formatLiteral));
    }
    else if (issue.code === "missing_key") {
        message = "missing key " + formatLiteral(issue.key);
    }
    else if (issue.code === "unrecognized_key") {
        message = "unrecognized key " + formatLiteral(issue.key);
    }
    else if (issue.code === "invalid_length") {
        var min = issue.minLength;
        var max = issue.maxLength;
        message = "expected an array with ";
        if (min > 0) {
            if (max === min) {
                message += "" + min;
            }
            else if (max < Infinity) {
                message += "between " + min + " and " + max;
            }
            else {
                message += "at least " + min;
            }
        }
        else {
            message += "at most " + max;
        }
        message += " item(s)";
    }
    else if (issue.code === "custom_error") {
        var error = issue.error;
        if (typeof error === "string") {
            message = error;
        }
        else if (error && error.message === "string") {
            message = error.message;
        }
    }
    var msg = issue.code + " at ." + path.join(".") + " (" + message + ")";
    if (count === 2) {
        msg += " (+ 1 other issue)";
    }
    else if (count > 2) {
        msg += " (+ " + (count - 1) + " other issues)";
    }
    return msg;
}
var ValitaFailure = /** @class */ (function () {
    function ValitaFailure(issueTree) {
        this.issueTree = issueTree;
        this.ok = false;
    }
    Object.defineProperty(ValitaFailure.prototype, "issues", {
        get: function () {
            var issues = collectIssues(this.issueTree);
            Object.defineProperty(this, "issues", {
                value: issues,
                writable: false,
            });
            return issues;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ValitaFailure.prototype, "message", {
        get: function () {
            var message = formatIssueTree(this.issueTree);
            Object.defineProperty(this, "message", {
                value: message,
                writable: false,
            });
            return message;
        },
        enumerable: false,
        configurable: true
    });
    ValitaFailure.prototype.throw = function () {
        throw new ValitaError(this.issueTree);
    };
    return ValitaFailure;
}());
var ValitaError = /** @class */ (function (_super) {
    __extends(ValitaError, _super);
    function ValitaError(issueTree) {
        var _newTarget = this.constructor;
        var _this = _super.call(this, formatIssueTree(issueTree)) || this;
        _this.issueTree = issueTree;
        Object.setPrototypeOf(_this, _newTarget.prototype);
        _this.name = _newTarget.name;
        return _this;
    }
    Object.defineProperty(ValitaError.prototype, "issues", {
        get: function () {
            var issues = collectIssues(this.issueTree);
            Object.defineProperty(this, "issues", {
                value: issues,
                writable: false,
            });
            return issues;
        },
        enumerable: false,
        configurable: true
    });
    return ValitaError;
}(Error));
export { ValitaError };
function joinIssues(left, right) {
    return left ? { code: "join", left: left, right: right } : right;
}
function prependPath(key, tree) {
    return { code: "prepend", key: key, tree: tree };
}
function isObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function toTerminals(type) {
    var result = [];
    type.toTerminals(result);
    return result;
}
function hasTerminal(type, name) {
    return toTerminals(type).some(function (t) { return t.name === name; });
}
var Nothing = Symbol();
var FuncMode;
(function (FuncMode) {
    FuncMode[FuncMode["PASS"] = 0] = "PASS";
    FuncMode[FuncMode["STRICT"] = 1] = "STRICT";
    FuncMode[FuncMode["STRIP"] = 2] = "STRIP";
})(FuncMode || (FuncMode = {}));
function ok(value) {
    return { ok: true, value: value };
}
function err(error) {
    return { ok: false, error: error };
}
var AbstractType = /** @class */ (function () {
    function AbstractType() {
    }
    Object.defineProperty(AbstractType.prototype, "func", {
        get: function () {
            var f = this.genFunc();
            Object.defineProperty(this, "func", {
                value: f,
                writable: false,
            });
            return f;
        },
        enumerable: false,
        configurable: true
    });
    AbstractType.prototype.parse = function (v, options) {
        var mode = FuncMode.PASS;
        if (options && options.mode === "strict") {
            mode = FuncMode.STRICT;
        }
        else if (options && options.mode === "strip") {
            mode = FuncMode.STRIP;
        }
        var r = this.func(v, mode);
        if (r === true) {
            return v;
        }
        else if (r.code === "ok") {
            return r.value;
        }
        else {
            throw new ValitaError(r);
        }
    };
    AbstractType.prototype.try = function (v, options) {
        var mode = FuncMode.PASS;
        if (options && options.mode === "strict") {
            mode = FuncMode.STRICT;
        }
        else if (options && options.mode === "strip") {
            mode = FuncMode.STRIP;
        }
        var r = this.func(v, mode);
        if (r === true) {
            return { ok: true, value: v };
        }
        else if (r.code === "ok") {
            return { ok: true, value: r.value };
        }
        else {
            return new ValitaFailure(r);
        }
    };
    AbstractType.prototype.optional = function () {
        return new Optional(this);
    };
    AbstractType.prototype.default = function (defaultValue) {
        return new DefaultType(this, defaultValue);
    };
    AbstractType.prototype.assert = function (func, error) {
        var err = { code: "custom_error", error: error };
        return new TransformType(this, function (v) { return (func(v) ? true : err); });
    };
    AbstractType.prototype.map = function (func) {
        return new TransformType(this, function (v) { return ({
            code: "ok",
            value: func(v),
        }); });
    };
    AbstractType.prototype.chain = function (func) {
        return new TransformType(this, function (v) {
            var r = func(v);
            if (r.ok) {
                return { code: "ok", value: r.value };
            }
            else {
                return { code: "custom_error", error: r.error };
            }
        });
    };
    return AbstractType;
}());
var Type = /** @class */ (function (_super) {
    __extends(Type, _super);
    function Type() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Type;
}(AbstractType));
var Optional = /** @class */ (function (_super) {
    __extends(Optional, _super);
    function Optional(type) {
        var _this = _super.call(this) || this;
        _this.type = type;
        _this.name = "optional";
        return _this;
    }
    Optional.prototype.genFunc = function () {
        var func = this.type.func;
        return function (v, mode) {
            return v === undefined || v === Nothing ? true : func(v, mode);
        };
    };
    Optional.prototype.toTerminals = function (into) {
        into.push(this);
        into.push(new UndefinedType());
        this.type.toTerminals(into);
    };
    return Optional;
}(AbstractType));
var DefaultType = /** @class */ (function (_super) {
    __extends(DefaultType, _super);
    function DefaultType(type, defaultValue) {
        var _this = _super.call(this) || this;
        _this.type = type;
        _this.defaultValue = defaultValue;
        _this.name = "default";
        return _this;
    }
    DefaultType.prototype.genFunc = function () {
        var func = this.type.func;
        var undefinedOutput = this.defaultValue === undefined
            ? true
            : { code: "ok", value: this.defaultValue };
        var nothingOutput = {
            code: "ok",
            value: this.defaultValue,
        };
        return function (v, mode) {
            if (v === undefined) {
                return undefinedOutput;
            }
            else if (v === Nothing) {
                return nothingOutput;
            }
            else {
                var result = func(v, mode);
                if (result !== true &&
                    result.code === "ok" &&
                    result.value === undefined) {
                    return nothingOutput;
                }
                return result;
            }
        };
    };
    DefaultType.prototype.toTerminals = function (into) {
        into.push(this.type.optional());
        this.type.toTerminals(into);
    };
    return DefaultType;
}(Type));
var ObjectType = /** @class */ (function (_super) {
    __extends(ObjectType, _super);
    function ObjectType(shape, restType, checks) {
        var _this = _super.call(this) || this;
        _this.shape = shape;
        _this.restType = restType;
        _this.checks = checks;
        _this.name = "object";
        return _this;
    }
    ObjectType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    ObjectType.prototype.check = function (func, error) {
        var _a;
        var issue = { code: "custom_error", error: error };
        return new ObjectType(this.shape, this.restType, __spreadArray(__spreadArray([], ((_a = this.checks) !== null && _a !== void 0 ? _a : [])), [
            {
                func: func,
                issue: issue,
            },
        ]));
    };
    ObjectType.prototype.genFunc = function () {
        var shape = this.shape;
        var rest = this.restType ? this.restType.func : undefined;
        var invalidType = { code: "invalid_type", expected: ["object"] };
        var checks = this.checks;
        var required = [];
        var optional = [];
        var knownKeys = Object.create(null);
        for (var key in shape) {
            if (hasTerminal(shape[key], "optional")) {
                optional.push(key);
            }
            else {
                required.push(key);
            }
            knownKeys[key] = true;
        }
        var keys = __spreadArray(__spreadArray([], required), optional);
        var funcs = keys.map(function (key) { return shape[key].func; });
        var requiredCount = required.length;
        return function (obj, mode) {
            if (!isObject(obj)) {
                return invalidType;
            }
            var strict = mode === FuncMode.STRICT;
            var strip = mode === FuncMode.STRIP;
            var issueTree = undefined;
            var output = obj;
            var setKeys = false;
            var copied = false;
            if (strict || strip || rest) {
                for (var key in obj) {
                    if (!Object.prototype.hasOwnProperty.call(knownKeys, key)) {
                        if (rest) {
                            var r = rest(obj[key], mode);
                            if (r !== true) {
                                if (r.code !== "ok") {
                                    issueTree = joinIssues(issueTree, prependPath(key, r));
                                }
                                else if (!issueTree) {
                                    if (!copied) {
                                        output = __assign({}, obj);
                                        copied = true;
                                    }
                                    output[key] = r.value;
                                }
                            }
                        }
                        else if (strict) {
                            return { code: "unrecognized_key", key: key };
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
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = obj[key];
                var found = true;
                if (value === undefined && !(key in obj)) {
                    if (i < requiredCount) {
                        return { code: "missing_key", key: key };
                    }
                    value = Nothing;
                    found = false;
                }
                var r = funcs[i](value, mode);
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
                        output = __assign({}, obj);
                        copied = true;
                    }
                    output[key] = r.value;
                }
            }
            if (checks && !issueTree) {
                for (var i = 0; i < checks.length; i++) {
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
    };
    ObjectType.prototype.rest = function (restType) {
        return new ObjectType(this.shape, restType);
    };
    ObjectType.prototype.extend = function (shape) {
        return new ObjectType(__assign(__assign({}, this.shape), shape), this.restType);
    };
    ObjectType.prototype.pick = function () {
        var _this = this;
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            keys[_i] = arguments[_i];
        }
        var shape = {};
        keys.forEach(function (key) {
            shape[key] = _this.shape[key];
        });
        return new ObjectType(shape, undefined);
    };
    ObjectType.prototype.omit = function () {
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            keys[_i] = arguments[_i];
        }
        var shape = __assign({}, this.shape);
        keys.forEach(function (key) {
            delete shape[key];
        });
        return new ObjectType(shape, this.restType);
    };
    ObjectType.prototype.partial = function () {
        var _this = this;
        var _a;
        var shape = {};
        Object.keys(this.shape).forEach(function (key) {
            shape[key] = _this.shape[key].optional();
        });
        var rest = (_a = this.restType) === null || _a === void 0 ? void 0 : _a.optional();
        return new ObjectType(shape, rest);
    };
    return ObjectType;
}(Type));
var ArrayType = /** @class */ (function (_super) {
    __extends(ArrayType, _super);
    function ArrayType(head, rest) {
        var _this = _super.call(this) || this;
        _this.head = head;
        _this.rest = rest;
        _this.name = "array";
        return _this;
    }
    ArrayType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    ArrayType.prototype.genFunc = function () {
        var _a;
        var headFuncs = this.head.map(function (t) { return t.func; });
        var restFunc = ((_a = this.rest) !== null && _a !== void 0 ? _a : never()).func;
        var minLength = headFuncs.length;
        var maxLength = this.rest ? Infinity : minLength;
        var invalidType = { code: "invalid_type", expected: ["array"] };
        var invalidLength = {
            code: "invalid_length",
            minLength: minLength,
            maxLength: maxLength,
        };
        return function (arr, mode) {
            if (!Array.isArray(arr)) {
                return invalidType;
            }
            var length = arr.length;
            if (length < minLength || length > maxLength) {
                return invalidLength;
            }
            var issueTree = undefined;
            var output = arr;
            for (var i = 0; i < arr.length; i++) {
                var func = i < minLength ? headFuncs[i] : restFunc;
                var r = func(arr[i], mode);
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
    };
    return ArrayType;
}(Type));
function toBaseType(v) {
    var type = typeof v;
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
    var output = [];
    var seen = new Set();
    for (var i = 0; i < arr.length; i++) {
        if (!seen.has(arr[i])) {
            output.push(arr[i]);
            seen.add(arr[i]);
        }
    }
    return output;
}
function findCommonKeys(rs) {
    var map = new Map();
    rs.forEach(function (r) {
        for (var key in r) {
            map.set(key, (map.get(key) || 0) + 1);
        }
    });
    var result = [];
    map.forEach(function (count, key) {
        if (count === rs.length) {
            result.push(key);
        }
    });
    return result;
}
function createObjectMatchers(t) {
    var objects = [];
    t.forEach(function (_a) {
        var root = _a.root, terminal = _a.terminal;
        if (terminal.name === "object") {
            objects.push({ root: root, terminal: terminal });
        }
    });
    var shapes = objects.map(function (_a) {
        var terminal = _a.terminal;
        return terminal.shape;
    });
    var common = findCommonKeys(shapes);
    var discriminants = common.filter(function (key) {
        var types = new Map();
        var literals = new Map();
        var optionals = [];
        var unknowns = [];
        for (var i = 0; i < shapes.length; i++) {
            var shape = shapes[i];
            var terminals = toTerminals(shape[key]);
            for (var j = 0; j < terminals.length; j++) {
                var terminal = terminals[j];
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
                    var options = literals.get(terminal.value) || [];
                    options.push(i);
                    literals.set(terminal.value, options);
                }
                else {
                    var options = types.get(terminal.name) || [];
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
        literals.forEach(function (found, value) {
            var options = types.get(toBaseType(value));
            if (options) {
                options.push.apply(options, found);
                literals.delete(value);
            }
        });
        var success = true;
        literals.forEach(function (found) {
            if (dedup(found.concat(unknowns)).length > 1) {
                success = false;
            }
        });
        types.forEach(function (found) {
            if (dedup(found.concat(unknowns)).length > 1) {
                success = false;
            }
        });
        return success;
    });
    return discriminants.map(function (key) {
        var flattened = flatten(objects.map(function (_a) {
            var root = _a.root, terminal = _a.terminal;
            return ({
                root: root,
                type: terminal.shape[key],
            });
        }));
        var optional = undefined;
        for (var i = 0; i < flattened.length; i++) {
            var _a = flattened[i], root = _a.root, terminal = _a.terminal;
            if (terminal.name === "optional") {
                optional = root;
                break;
            }
        }
        return {
            key: key,
            optional: optional,
            matcher: createUnionMatcher(flattened, [key]),
        };
    });
}
function createUnionMatcher(t, path) {
    var order = new Map();
    t.forEach(function (_a, i) {
        var _b;
        var root = _a.root;
        order.set(root, (_b = order.get(root)) !== null && _b !== void 0 ? _b : i);
    });
    var byOrder = function (a, b) {
        var _a, _b;
        return ((_a = order.get(a)) !== null && _a !== void 0 ? _a : 0) - ((_b = order.get(b)) !== null && _b !== void 0 ? _b : 0);
    };
    var expectedTypes = [];
    var literals = new Map();
    var types = new Map();
    var unknowns = [];
    var optionals = [];
    t.forEach(function (_a) {
        var root = _a.root, terminal = _a.terminal;
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
            var roots = literals.get(terminal.value) || [];
            roots.push(root);
            literals.set(terminal.value, roots);
            expectedTypes.push(toBaseType(terminal.value));
        }
        else {
            var roots = types.get(terminal.name) || [];
            roots.push(root);
            types.set(terminal.name, roots);
            expectedTypes.push(terminal.name);
        }
    });
    literals.forEach(function (roots, value) {
        var options = types.get(toBaseType(value));
        if (options) {
            options.push.apply(options, roots);
            literals.delete(value);
        }
    });
    unknowns = dedup(unknowns).sort(byOrder);
    optionals = dedup(optionals).sort(byOrder);
    types.forEach(function (roots, type) {
        return types.set(type, dedup(roots.concat(unknowns).sort(byOrder)));
    });
    literals.forEach(function (roots, value) {
        return literals.set(value, dedup(roots.concat(unknowns)).sort(byOrder));
    });
    var expectedLiterals = [];
    literals.forEach(function (_, value) {
        expectedLiterals.push(value);
    });
    var invalidType = {
        code: "invalid_type",
        path: path,
        expected: dedup(expectedTypes),
    };
    var invalidLiteral = {
        code: "invalid_literal",
        path: path,
        expected: expectedLiterals,
    };
    var literalTypes = new Set(expectedLiterals.map(toBaseType));
    return function (rootValue, value, mode) {
        var count = 0;
        var issueTree;
        if (value === Nothing) {
            for (var i = 0; i < optionals.length; i++) {
                var r = optionals[i].func(rootValue, mode);
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
        var type = toBaseType(value);
        var options = literals.get(value) || types.get(type) || unknowns;
        for (var i = 0; i < options.length; i++) {
            var r = options[i].func(rootValue, mode);
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
    var result = [];
    t.forEach(function (_a) {
        var root = _a.root, type = _a.type;
        return toTerminals(type).forEach(function (terminal) {
            result.push({ root: root, terminal: terminal });
        });
    });
    return result;
}
var UnionType = /** @class */ (function (_super) {
    __extends(UnionType, _super);
    function UnionType(options) {
        var _this = _super.call(this) || this;
        _this.options = options;
        _this.name = "union";
        return _this;
    }
    UnionType.prototype.toTerminals = function (into) {
        this.options.forEach(function (o) { return o.toTerminals(into); });
    };
    UnionType.prototype.genFunc = function () {
        var flattened = flatten(this.options.map(function (root) { return ({ root: root, type: root }); }));
        var hasUnknown = hasTerminal(this, "unknown");
        var objects = createObjectMatchers(flattened);
        var base = createUnionMatcher(flattened);
        return function (v, mode) {
            if (!hasUnknown && objects.length > 0 && isObject(v)) {
                var item = objects[0];
                var value = v[item.key];
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
    };
    UnionType.prototype.optional = function () {
        return new Optional(this);
    };
    return UnionType;
}(Type));
var NeverType = /** @class */ (function (_super) {
    __extends(NeverType, _super);
    function NeverType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "never";
        return _this;
    }
    NeverType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: [] };
        return function (v, _mode) { return (v === Nothing ? true : issue); };
    };
    NeverType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return NeverType;
}(Type));
var UnknownType = /** @class */ (function (_super) {
    __extends(UnknownType, _super);
    function UnknownType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "unknown";
        return _this;
    }
    UnknownType.prototype.genFunc = function () {
        return function (_v, _mode) { return true; };
    };
    UnknownType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return UnknownType;
}(Type));
var NumberType = /** @class */ (function (_super) {
    __extends(NumberType, _super);
    function NumberType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "number";
        return _this;
    }
    NumberType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: ["number"] };
        return function (v, _mode) { return (typeof v === "number" ? true : issue); };
    };
    NumberType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return NumberType;
}(Type));
var StringType = /** @class */ (function (_super) {
    __extends(StringType, _super);
    function StringType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "string";
        return _this;
    }
    StringType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: ["string"] };
        return function (v, _mode) { return (typeof v === "string" ? true : issue); };
    };
    StringType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return StringType;
}(Type));
var Scalar = /** @class */ (function (_super) {
    __extends(Scalar, _super);
    function Scalar() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "scalar";
        return _this;
    }
    Scalar.prototype.genFunc = function () {
        return function (_, _mode) { return true; };
    };
    Scalar.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return Scalar;
}(Type));
var BigIntType = /** @class */ (function (_super) {
    __extends(BigIntType, _super);
    function BigIntType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "bigint";
        return _this;
    }
    BigIntType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: ["bigint"] };
        return function (v, _mode) { return (typeof v === "bigint" ? true : issue); };
    };
    BigIntType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return BigIntType;
}(Type));
var BooleanType = /** @class */ (function (_super) {
    __extends(BooleanType, _super);
    function BooleanType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "boolean";
        return _this;
    }
    BooleanType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: ["boolean"] };
        return function (v, _mode) { return (typeof v === "boolean" ? true : issue); };
    };
    BooleanType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return BooleanType;
}(Type));
var UndefinedType = /** @class */ (function (_super) {
    __extends(UndefinedType, _super);
    function UndefinedType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "undefined";
        return _this;
    }
    UndefinedType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: ["undefined"] };
        return function (v, _mode) { return (v === undefined ? true : issue); };
    };
    UndefinedType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return UndefinedType;
}(Type));
var NullType = /** @class */ (function (_super) {
    __extends(NullType, _super);
    function NullType() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.name = "null";
        return _this;
    }
    NullType.prototype.genFunc = function () {
        var issue = { code: "invalid_type", expected: ["null"] };
        return function (v, _mode) { return (v === null ? true : issue); };
    };
    NullType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return NullType;
}(Type));
var LiteralType = /** @class */ (function (_super) {
    __extends(LiteralType, _super);
    function LiteralType(value) {
        var _this = _super.call(this) || this;
        _this.value = value;
        _this.name = "literal";
        return _this;
    }
    LiteralType.prototype.genFunc = function () {
        var value = this.value;
        var issue = { code: "invalid_literal", expected: [value] };
        return function (v, _) { return (v === value ? true : issue); };
    };
    LiteralType.prototype.toTerminals = function (into) {
        into.push(this);
    };
    return LiteralType;
}(Type));
var TransformType = /** @class */ (function (_super) {
    __extends(TransformType, _super);
    function TransformType(transformed, transform) {
        var _this = _super.call(this) || this;
        _this.transformed = transformed;
        _this.transform = transform;
        _this.name = "transform";
        return _this;
    }
    TransformType.prototype.genFunc = function () {
        var chain = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        var next = this;
        while (next instanceof TransformType) {
            chain.push(next.transform);
            next = next.transformed;
        }
        chain.reverse();
        var func = next.func;
        var undef = { code: "ok", value: undefined };
        return function (v, mode) {
            var result = func(v, mode);
            if (result !== true && result.code !== "ok") {
                return result;
            }
            var current;
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
            for (var i = 0; i < chain.length; i++) {
                var r = chain[i](current, mode);
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
    };
    TransformType.prototype.toTerminals = function (into) {
        this.transformed.toTerminals(into);
    };
    return TransformType;
}(Type));
var LazyType = /** @class */ (function (_super) {
    __extends(LazyType, _super);
    function LazyType(definer) {
        var _this = _super.call(this) || this;
        _this.definer = definer;
        _this.name = "lazy";
        return _this;
    }
    Object.defineProperty(LazyType.prototype, "type", {
        get: function () {
            var type = this.definer();
            Object.defineProperty(this, "type", {
                value: type,
                writable: false,
            });
            return type;
        },
        enumerable: false,
        configurable: true
    });
    LazyType.prototype.genFunc = function () {
        return this.type.genFunc();
    };
    LazyType.prototype.toTerminals = function (into) {
        this.type.toTerminals(into);
    };
    return LazyType;
}(Type));
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
function union() {
    var options = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        options[_i] = arguments[_i];
    }
    return new UnionType(options);
}
function lazy(definer) {
    return new LazyType(definer);
}
export { never, unknown, number, bigint, string, boolean, object, record, array, tuple, literal, union, null_ as null, undefined_ as undefined, scalar, lazy, ok, err, };
//# sourceMappingURL=index.js.map