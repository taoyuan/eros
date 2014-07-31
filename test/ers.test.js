"use strict";

var ers = require('..');
var http = require('http');
var t = require('chai').assert;

describe('ers export structure', function() {
    it('should contain find() method', function() {
        t.typeOf(ers, 'object');
        t.property(ers, 'find');
        t.isFunction(ers.find, 'function');
    });

    it('should contain a construct method', function() {
        t.isFunction(ers.construct, 'function');
    });

});

var FatalError = ers.construct({
    name: 'FatalError',
    defaultMessage: 'A Fatal Error Occurred.'
});
var FatalDBError = ers.construct({
    name: 'FatalDBError',
    parent: FatalError,
    defaultMessage: 'A Fatal Database Error Occurred.'
});
var FatalDBTransactionError = ers.construct({
    name: 'FatalDBTransactionError',
    parent: FatalDBError,
    defaultMessage: 'A Fatal Database Transaction Error Occurred.'
});

var fatalError = new FatalError();
var fatalDBError = new FatalDBError();
var fatalDBTransError = new FatalDBTransactionError();

describe('ers inheritance', function() {

    it('FatalError extends Error', function() {
        t.equal(ers.FatalError, FatalError);
        t.typeOf(FatalError, 'function');
        t.instanceOf(fatalError, Error);
        t.ok(fatalError.code > 599);
        t.equal(fatalError.message, 'A Fatal Error Occurred.');
        t.equal(fatalError.status, 500);
    });

    it('FatalDBError extends FatalError', function() {
        t.equal(ers.FatalDBError, FatalDBError);
        t.typeOf(FatalDBError, 'function');
        t.instanceOf(fatalDBError, FatalError);
        t.notInstanceOf(fatalDBError, FatalDBTransactionError);
        t.ok(fatalDBError.code > 599);
        t.notEqual(fatalDBError.code, new FatalError().code);
        t.equal(fatalDBError.message, 'A Fatal Database Error Occurred.');
        t.equal(fatalDBError.status, 500);
    });

    it('FatalDBTransactionError extends FatalDBError', function() {
        t.equal(ers.FatalDBTransactionError, FatalDBTransactionError);
        t.typeOf(FatalDBTransactionError, 'function');
        t.instanceOf(fatalDBTransError, FatalDBError);
        t.ok(fatalDBTransError.code > 599);
        t.notEqual(fatalDBTransError.code, new FatalDBError().code);
        t.equal(fatalDBTransError.message, 'A Fatal Database Transaction Error Occurred.');
        t.equal(fatalDBTransError.status, 500);
    });
});

describe('ers.find()', function() {

    it('should find existing error by code', function() {
        t.equal(ers.find(fatalDBError.code), FatalDBError);
    });

    it('should find existing error by name', function() {
        t.equal(ers.find(fatalDBError.name), FatalDBError);
    });

    it('should not find error for non-existing code', function() {
        t.notOk(ers.find(9999));
    });

    it('should not find error for non-existing name', function() {
        t.notOk(ers.find('FatalDDBError'));
    });
});

describe('ers unique error code generation', function() {

    it('should construct unique error codes', function() {
        t.notEqual(fatalError.code, fatalDBError.code);
        t.notEqual(fatalDBError.code, fatalDBTransError.code);
    });

    it('should not hammer existing error code', function() {
        var FileNotFoundError = ers.construct({
            name: 'FileNotFoundError',
            code: fatalDBTransError.code + 1
        });
        var IOError = ers.construct({
            name: 'IOError'
        });

        var fnfError = new FileNotFoundError()
            , ioError = new IOError();

        t.notEqual(fnfError.code, ioError.code);
        t.ok(ioError.code > fatalDBTransError.code);
    });
});

describe('default error message handling', function() {

    var FileEncodingError = ers.construct({
        name: 'FileEncodingError',
        defaultMessage: 'File encoding is invalid and cannot be read.'
    });
    var feError = new FileEncodingError();

    it('should use default message when none specified', function() {
        t.equal(feError.message, 'File encoding is invalid and cannot be read.');
    });

    it('should allow default message overriding', function() {
        var err = new FileEncodingError('dude, the encoding is bad');
        t.equal(err.message, 'dude, the encoding is bad');
    });
});

describe('scoped creation', function() {
    var MalformedInputError = ers.construct({
        name: 'MalformedInputError',
        scope: exports
    });

    it('should exist in exports', function() {
        t.ok(exports.MalformedInputError);
        t.equal(exports.MalformedInputError, MalformedInputError);
    });

    it('should find error in exports', function() {
        t.equal(ers.find('MalformedInputError'), MalformedInputError);
        var err = new MalformedInputError();
        t.equal(ers.find(err.code), MalformedInputError);
    });
});

describe('ers.stacks()', function() {
    var err = new ers.EntityTooLargeError();

    it('should enable stack traces', function() {
        ers.stacks(true);
        t.include(err.toString(), err.stack);
    });

    it('should return current value of stacks', function() {
        t.equal(ers.stacks(), true);
    });

    it('should disable stack traces', function() {
        ers.stacks(false);
        t.notInclude(err.toString(), err.stack);
    });

    it('should return current value of stacks', function() {
        t.equal(ers.stacks(), false);
    });
});

describe('options style constructor', function() {
    var IdentifiableError = ers.construct('IdentifiableError'),
        err = new IdentifiableError({message: 'Error with ref ID',
            status: 501, refID: 'a1b2c3'});

    it('should contain refID property', function() {
        t.equal(err.refID, 'a1b2c3');
    });

    it('should have overridden status', function() {
        t.equal(err.status, 501);
    });

    it('toString() should output refID', function() {
        t.include(err.toString(), 'refID: a1b2c3');
    });

    it('toJSON() should include refID', function() {
        t.propertyVal(err.toJSON(), 'refID',  'a1b2c3');
    });

    it('should have overriden message', function() {
        t.include(err.toString(), ': Error with ref ID');
    });

    it('should not allow overriding of stack', function() {
        t.throw(function() {new IdentifiableError({stack: 'fail'});});
    });

    it('should not allow overriding of name', function() {
        t.throw(function() {new IdentifiableError({name: 'fail'});});
    });

    it('should not allow overriding of code', function() {
        t.throw(function() {new IdentifiableError({code: 601});});
    });
});

describe('status code override', function() {
    var CustomHttpError = ers.construct({name: 'CustomHttpError', status: 409}),
        err = new CustomHttpError();

    it('should have status of 409', function() {
        t.equal(err.status, 409);
    });

    it('should include 409 status in toJSON()', function() {
        t.propertyVal(err.toJSON(), 'status', 409);
    });

    it('should allow overriding in constructor', function() {
        t.equal(new CustomHttpError({status:411}).status, 411);
    });
});