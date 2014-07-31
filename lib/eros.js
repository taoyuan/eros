"use strict";

var util = require('util');
var http = require('http');

/**
 * JavaScript Error constructors indexed by name
 * for convenience.
 *
 * Examples:
 *
 *  new errors.sys.URIError('Malformed URI');
 *
 */

exports.sys = {
    Error: Error
    , EvalError: EvalError
    , RangeError: RangeError
    , ReferenceError: ReferenceError
    , SyntaxError: SyntaxError
    , TypeError: TypeError
    , URIError: URIError
};

/*!
 * error constructors indexed by code
 */

var codes = {};

/*!
 * error constructors indexed by name
 */

var names = {};


/*!
 * Module global to track if we should use stack traces.
 */

var useStack = false;

/**
 * Cache the given error constructor indexed by the
 * given name and code.
 *
 * @param name {String} name
 * @param code {Number} code
 * @param err {Function} err
 * @api private
 */

function cache(name, code, err) {
    names[name] = err;
    codes[code] = err;
}

/*!
 * next free error code
 */

var freeCode = 600;

/**
 * Return the next free error code.
 *
 * @returns {Number}
 * @api private
 */

function nextCode() {
    while(codes[freeCode]) {
        freeCode += 1;
    }
    return freeCode;
}

/**
 * Returns the error constructor by the given code or
 * name.
 *
 * Examples:
 *
 *  errors.find(404);
 *  // => Http404Error
 *
 *  errors.find(500);
 *  // => Http500Error
 *
 *  errors.find('Http401Error');
 *  // => http401Error
 *
 *
 * @param {String|Number} err
 * @returns {Function}
 * @api public
 */

exports.find = function(err) {
    return (typeof err == 'number') ? codes[err] : names[err];
};

/**
 * Determines if the given `Error` object was created using
 * the errors framework.
 *
 * @param {Object} err The error to check
 * @returns {Boolean}
 * @api private
 */

exports.isError = function isError(err) {
    return err && err.hasOwnProperty('explanation') && err.hasOwnProperty('code');
};

function forDefinedVal() {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) {
            return arguments[i];
        }
    }
    return undefined;
}

/**
 * Create a new constructor instance based
 * on the given options.
 *
 * This factory method allows consumers to build
 * parameterized error constructor function instances
 * which can then be used to instantiate new concrete
 * instances of the given error.
 *
 * This method accepts jQuery style `options` argument
 * with the following properties (note that `name` is
 * the only required property, all others are optional).
 *
 * The `scope` option can be used to change the default
 * namespace to construct the constructor in. If unspecified
 * it defaults to the `exports` object of this module
 * (i.e. `errors.exports`).
 *
 * The `parent` option specifies the parent to inherit
 * from. If unspecified it defaults to `Error`.
 *
 * The `defaultMessage`, `defaultExplanation` and
 * `defaultResponse` define the default text to use
 * for the new errors `message`, `explanation` and
 * `response` respectively. These values can be
 * overridden at construction time.
 *
 * The `code` specifies the error code for the new
 * error. If unspecified it defaults to a generated
 * error number which is greater than or equal to
 * 600.
 *
 * Examples:
 *
 *  // use all defaults
 *  errors.construct({name: 'FileNotFoundError'});
 *  throw new errors.FileNotFoundError("Could not find file x");
 *
 *  // inheritance
 *  errors.construct({
 *      name: 'FatalError',
 *      code: 900
 *  });
 *  errors.construct({
 *      name: 'DatabaseError',
 *      parent: errors.FatalError
 *      code: 901
 *  });
 *  var dbe = new errors.DatabaseError("Internal database error");
 *  dbe instanceof errors.FatalError;
 *  // => true
 *
 *  // scoping to current module exports
 *  var MalformedEncodingError = errors.construct({
 *      name: 'MalformedEncodingError',
 *      scope: exports
 *  });
 *  throw new MalformedEncodingError("Encoding not supported");
 *
 *  // default message
 *  errors.construct({
 *      name: 'SocketReadError',
 *      code: 4000,
 *      defaultMessage: 'Could not read from socket'
 *  });
 *  var sre = new errors.SocketReadError();
 *  sre.message;
 *  // => 'Could not read from socket'
 *  sre.code;
 *  // => 4000
 *  sre instanceof Error;
 *  // => true
 *
 *  // explanation and response
 *  errors.construct({
 *      name: 'SocketReadError',
 *      code: 4000,
 *      defaultMessage: 'Could not read from socket',
 *      defaultExplanation: 'Unable to obtain a reference to the socket',
 *      defaultResponse: 'Specify a different port or socket and retry the operation'
 *  });
 *  var sre = new errors.SocketReadError();
 *  sre.explanation;
 *  // => 'Unable to obtain a reference to the socket'
 *  sre.response;
 *  // => 'Specify a different port or socket and retry the operation'
 *
 * @param {Function} [parent] The parent error class.
 * @param {String} [name] The error class name.
 * @param {Object} [options] The options.
 * @param {String} options.name The constructor name.
 * @param {Object} options.scope The scope (i.e. namespace).
 * @param {Function} options.parent The parent to inherit from.
 * @param {String} options.defaultMessage The default message.
 * @param {Number} options.code The error code.
 * @param {Number} options.status The status code.
 * @param {String} options.defaultExplanation The default explanation.
 * @param {String} options.defaultResponse The default operator response.
 * @return {Function} the newly created constructor
 * @api public
 */

var construct = exports.construct = function(/*parent, name, options*/) {
    var parent, name, options;
    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        var type = typeof arg;
        if (!parent && type === 'function') {
            parent = arg;
        } else if (!name && type === 'string') {
            name = arg;
        } else if (!options && type === 'object') {
            options = arg;
        }
    }
    options = options || {};
    parent = parent || options.parent || Error;
    var scope = options.scope || exports
        , defaultMessage = options.defaultMessage || 'An unexpected ' + options.name + ' occurred.'
        , className = name || options.name
        , errorCode = options.code || nextCode()
        , statusCode = options.status
        , defaultExplanation = options.defaultExplanation
        , defaultResponse = options.defaultResponse
        , formattedStack
        , stack = {};


    /**
     * Create a new instance of the exception which accepts
     * 2 forms of parameters.
     *
     * (a) Passing the message, explanation and response
     * as individual argument strings:
     * Create a new instance of the exception optionally
     * specifying a message, explanation and response
     * for the new instance. If any of the arguments are
     * null, their value will default to their respective
     * default value use on the `construct` call, or will
     * be null if no default was specified.
     *
     * (b) Passing an options style object which contains
     * key / value pairs. In this form keys map to the
     * attributes of the error object. Note that the properties
     * 'stack', 'name' and 'code' cannot be set via the options
     * style object in this form.
     *
     * @param {String} [msg] The message to use for the error.
     * @param {String} [expl] The explanation to use for the error.
     * @param {String} [fix] The response to use for the error.
     * @param {Object} [options] The options.
     * @return {Object} The newly created error.
     */

    var ErrorClass = scope[className] = function(msg, expl, fix, options) {
        if (!(this instanceof ErrorClass)) return new ErrorClass(msg, expl, fix, options);
        if (msg && typeof msg === 'object') {
            options = msg;
            msg = expl = fix = undefined;
        } else if (expl && typeof expl === 'object') {
            options = expl;
            expl = fix = undefined;
        } else if (fix && typeof fix === 'object') {
            options = fix;
            fix = undefined;
        }
        options = options || {};

        if (options.hasOwnProperty('stack') || options.hasOwnProperty('name') | options.hasOwnProperty('code')) {
            throw Error("Properties 'stack', 'name' or 'code' cannot be overridden");
        }

        options['status'] = options['status'] || statusCode;
        msg = forDefinedVal(msg,  options.msg,  options.message,  defaultMessage);
        expl = forDefinedVal(expl,  options.expl,  options.explanation,  defaultExplanation);
        fix = forDefinedVal(fix,  options.fix,  options.response,  defaultResponse);

        parent.call(this, msg, expl, fix, options);

        // hack around the defineProperty for stack so
        // we can delay stack formatting until access
        // for performance reasons
        Error.captureStackTrace(stack, ErrorClass);

        /**
         * Return the stack tracks for the error.
         *
         * @return {String}
         * @api public
         */
        Object.defineProperty(this, 'stack', {
            configurable: true,
            enumerable: false,
            get: function() {
                if (!formattedStack) {
                    formattedStack = stack.stack.replace('[object Object]', 'Error: ' + this.message);
                }
                return formattedStack;
            }
        });

        /**
         * Return the explanation for this error.
         *
         * @return {String}
         * @api public
         */

        Object.defineProperty(this, 'explanation', {
            value: options['explanation'] || expl,
            configurable: true,
            enumerable: true
        });

        /**
         * Return the operator response for this error.
         *
         * @return {String}
         * @api public
         */

        Object.defineProperty(this, 'response', {
            value: options['response'] || fix,
            configurable: true,
            enumerable: true
        });

        /**
         * Return the error code.
         *
         * @return {Number}
         * @api public
         */

        Object.defineProperty(this, 'code', {
            value: options['code'] || errorCode,
            configurable: true,
            enumerable: true
        });

        /**
         * HTTP status code of this error.
         *
         * If the instance's `code` is not a valid
         * HTTP status code it's normalized to 500.s
         *
         * @return {Number}
         * @api public
         */

        Object.defineProperty(this, 'status', {
            value: options['status'] || (http.STATUS_CODES[errorCode] ? errorCode : 500),
            configurable: true,
            // normalize for http status code and connect compat
            enumerable: true
        });

        /**
         * Name of this error.
         *
         * @return {String}
         * @api public
         */

        Object.defineProperty(this, 'name', {
            value: className,
            configurable: true,
            enumerable: true
        });

        /**
         * Message for this error.
         *
         * @return {String}
         * @api public
         */

        Object.defineProperty(this, 'message', {
            value: msg,
            configurable: true,
            enumerable: true
        });

        // expose extra conf options as properties
        for (var key in options) {
            if (!this.hasOwnProperty(key)) {
                Object.defineProperty(this, key, {
                    value: options[key],
                    configurable: true,
                    enumerable: true
                });
            }
        }

    };

    util.inherits(ErrorClass, parent);

    /**
     * Return the name of the prototype.
     *
     * @return {String}
     * @api public
     */

    Object.defineProperty(ErrorClass.prototype, 'name', {
        value: className,
        enumerable: true
    });

    /**
     * Return a formatted string for this error which
     * includes the error's `name`, `message` and `code`.
     * The string will also include the `explanation` and
     * `response` if they are set for this instance.
     *
     * Can be redefined by consumers to change formatting.
     *
     * @return {String}
     * @api public
     */

    ErrorClass.prototype.toString = function() {

        /*!

         The snippet below would allow us to provide connect errorHandler()
         middleware compatible errors, but is too costly. In a 1000 executions
         of toString() it adds ~25% overhead.

         var e = Error();
         Error.captureStackTrace(e);
         if (~e.stack.indexOf("connect/lib/middleware/errorHandler.js")) {
         return this.message;
         }
         */

        // TODO externalization
        var msg = util.format("%s: %s\nCode: %s", this.name, this.message, this.code);
        if (this.explanation) {
            msg += "\nExplanation: " + this.explanation;
        }
        if (this.response) {
            msg += "\nResponse: " + this.response;
        }

        function isExtra(key) {
            return ['name', 'message', 'status', 'code',
                'response', 'explanation', 'stack'].indexOf(key) < 0;
        }

        // extra properties
        Object.keys(this).filter(isExtra).forEach(function(key) {
            msg += util.format("\n%s: %s", key, this[key]);
        }, this);

        if (useStack) {
            msg += "\n" + this.stack;
        }
        return msg;
    };

    /**
     * Return the JSON representation of this error
     * which includes it's `name`, `code`, `message`
     * and `status`. The JSON object returned will
     * also include the `explanation` and `response`
     * if defined for this instance.
     *
     * This method can be redefined for customized
     * behavior of `JSON.stringify()`.
     *
     * @return {Object}
     * @api public
     */

    ErrorClass.prototype.toJSON = function() {
        // TODO externalization
        return useStack
            ? mixin(this, {stack: this.stack}, true)
            : mixin(this, {}, true);
    };

    cache(className, errorCode, ErrorClass);

    return ErrorClass;
};


/**
 * Get/set the module default behavior in terms of if
 * stack traces should be included in `toString()`,
 * `send()`ing errors, etc.
 *
 * When called with no parameters this method will return
 * if the errors module is set to use stacks or not.
 *
 * When called with a single boolean parameter this
 * method will interally set if stack traces should be used.
 *
 * @param {Boolean} [useStacks]
 * @api public
 */

exports.stacks = function(useStacks) {
    if (useStacks == null || useStacks == undefined) {
        return useStack;
    }
    useStack = useStacks;
};

/**
 * Perform a top level mixing between and source
 * and destination object optionally skipping
 * undefined/null properties.
 *
 * Examples:
 *
 *  mixin({a: 'A'}, {b: 'B});
 *  // => {a: 'A', b: 'B'}
 *
 *  mixin({'a': null}, {b: 'B}, true);
 *  // => {b: 'B'}
 *
 * @param {Object} src
 * @param {Object} dest
 * @param {Boolean} skipEmpty
 * @returns {Object}
 * @api private
 */

function mixin(src, dest, skipEmpty) {
    // TODO: refactor into common module
    dest = dest || {};
    src = src || {};
    Object.keys(src).forEach(function(key) {
        if (!dest[key] && (skipEmpty && src[key] != null && src[key] != undefined)) {
            dest[key] = src[key];
        }
    });
    return dest;
}

/**
 * Base `Error` for web app HTTP based
 * exceptions -- all 4xx and 5xx wrappered
 * errors are instances of `HttpError`.
 */

var HttpError = exports.HttpError = construct('HttpError');

exports.BadRequestError = construct(HttpError, 'BadRequestError', { code: 400 });
exports.badRequest = function (message, data) {
    return exports.BadRequestError(message, { data: data });
};

exports.UnauthorizedError = construct(HttpError, 'UnauthorizedError', { code: 400 });
exports.unauthorized = function (message) {
    return exports.UnauthorizedError(message);
};

exports.ForbiddenError = construct(HttpError, 'ForbiddenError', { code: 403 });
exports.forbidden = function (message, data) {
    return exports.ForbiddenError(message, { data: data });
};

exports.NotFoundError = construct(HttpError, 'NotFoundError', { code: 404 });
exports.notFound = function (message, data) {
    return exports.NotFoundError(message, { data: data });
};

exports.MethodNotAllowedError = construct(HttpError, 'MethodNotAllowedError', { code: 405 });
exports.methodNotAllowed = function (message, data) {
    return exports.MethodNotAllowedError(message, { data: data });
};

exports.NotAcceptableError = construct(HttpError, 'NotAcceptableError', { code: 406 });
exports.notAcceptable = function (message, data) {
    return exports.NotAcceptableError(message, { data: data });
};

exports.ProxyAuthRequiredError = construct(HttpError, 'ProxyAuthRequiredError', { code: 407 });
exports.proxyAuthRequired = function (message, data) {
    return exports.ProxyAuthRequiredError(message, { data: data });
};

exports.ClientTimeoutError = construct(HttpError, 'ClientTimeoutError', { code: 408 });
exports.clientTimeout = function (message, data) {
    return exports.ClientTimeoutError(message, { data: data });
};

exports.ConflictError = construct(HttpError, 'ConflictError', { code: 409 });
exports.conflict = function (message, data) {
    return exports.ConflictError(message, { data: data });
};

exports.ResourceGoneError = construct(HttpError, 'ResourceGoneError', { code: 410 });
exports.resourceGone = function (message, data) {
    return exports.ResourceGoneError(message, { data: data });
};

exports.LengthRequiredError = construct(HttpError, 'LengthRequiredError', { code: 411 });
exports.lengthRequired = function (message, data) {
    return exports.LengthRequiredError(message, { data: data });
};

exports.PreconditionFailedError = construct(HttpError, 'PreconditionFailedError', { code: 412 });
exports.preconditionFailed = function (message, data) {
    return exports.PreconditionFailedError(message, { data: data });
};

exports.EntityTooLargeError = construct(HttpError, 'EntityTooLargeError', { code: 413 });
exports.entityTooLarge = function (message, data) {
    return exports.EntityTooLargeError(message, { data: data });
};

exports.UriTooLongError = construct(HttpError, 'UriTooLongError', { code: 414 });
exports.uriTooLong = function (message, data) {
    return exports.UriTooLongError(message, { data: data });
};

exports.UnsupportedMediaTypeError = construct(HttpError, 'UnsupportedMediaTypeError', { code: 415 });
exports.unsupportedMediaType = function (message, data) {
    return exports.UnsupportedMediaTypeError(message, { data: data });
};

exports.RangeNotSatisfiableError = construct(HttpError, 'RangeNotSatisfiableError', { code: 416 });
exports.rangeNotSatisfiable = function (message, data) {
    return exports.RangeNotSatisfiableError(message, { data: data });
};

exports.ExpectationFailedError = construct(HttpError, 'ExpectationFailedError', { code: 417 });
exports.expectationFailed = function (message, data) {
    return exports.ExpectationFailedError(message, { data: data });
};

// 5xx Server Errors
var InternalError = exports.InternalError = construct(HttpError, 'InternalError', { code: 500 });
exports.internal = function (message, data) {
    return exports.InternalError(message, { data: data });
};

exports.NotImplementedError = construct(InternalError, 'NotImplementedError', { code: 501 });
exports.notImplemented = function (message, data) {
    return exports.NotImplementedError(message, { data: data });
};

exports.BadGatewayError = construct(InternalError, 'BadGatewayError', { code: 502 });
exports.badGateway = function (message, data) {
    return exports.BadGatewayError(message, { data: data });
};

exports.ServerTimeoutError = construct(InternalError, 'ServerTimeoutError', { code: 503 });
exports.serverTimeout = function (message, data) {
    return exports.ServerTimeoutError(message, { data: data });
};

exports.GatewayTimeoutError = construct(InternalError, 'GatewayTimeoutError', { code: 504 });
exports.gatewayTimeout = function (message, data) {
    return exports.GatewayTimeoutError(message, { data: data });
};

exports.BadImplementationError = construct(InternalError, 'BadImplementationError', { code: 505 });
exports.badImplementation = function (message, data) {
    var err = exports.BadImplementationError(message, { data: data });
    err.isDeveloperError = true;
    return err;
};