// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-remoting
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var debug = require('debug')('test');
var expect = require('chai').expect;
var express = require('express');
var extend = require('util')._extend;
var format = require('util').format;
var supertest = require('supertest');

var RemoteObjects = require('..');

describe('Coercion in RestAdapter', function() {
  var remoteObjects, request;

  before(setupRemoteServer);
  beforeEach(setupRemoteObjects);
  after(stopRemoteServer);

  context('for query string of type', function() {
    var EMPTY_QUERY = '';
    var ERROR_BAD_REQUEST = new Error(400);

    describe('boolean - optional', function() {
      verifyTestCases({ arg: 'arg', type: 'boolean' }, [
        [EMPTY_QUERY, false /* should be: undefined */],
        ['?arg', false, /* should be: undefined */],
        ['?arg=undefined', false /* should be: ERROR_BAD_REQUEST */],
        ['?arg=null', false, /* should be: ERROR_BAD_REQUEST */],
        ['?arg=false', false ],
        ['?arg=true', true ],
        ['?arg=0', false ],
        ['?arg=1', true ],
        ['?arg=[]', true /* should be: ERROR_BAD_REQUEST */],
        ['?arg=[1,2]', true /* should be: ERROR_BAD_REQUEST */],
        ['?arg={}', true /* should be: ERROR_BAD_REQUEST */],
        ['?arg={"a":true}', true /* should be: ERROR_BAD_REQUEST */],
      ]);
    });

    describe('boolean - required', function() {
      verifyTestCases({ arg: 'arg', type: 'boolean', required: true }, [
        [EMPTY_QUERY, false /* should be: ERROR_BAD_REQUEST */],
        ['?arg', false /* should be: ERROR_BAD_REQUEST */],
        ['?arg=undefined', false /* should be: ERROR_BAD_REQUEST (?) */],
        ['?arg=null', false /* should be: ERROR_BAD_REQUEST (?) */],
        ['?arg=false', false ],
        ['?arg=true', true ],
        ['?arg=0', false ],
        ['?arg=1', true ]
      ]);
    });

    describe('number - optional', function() {
      verifyTestCases({ arg: 'arg', type: 'number' }, [
        [EMPTY_QUERY, undefined],
        ['?arg', 0, /* should be: undefined */],
        ['?arg=undefined', ERROR_BAD_REQUEST],
        ['?arg=null', ERROR_BAD_REQUEST],
        ['?arg=0', 0 ],
        ['?arg=1', 1 ],
        ['?arg=-1', -1 ],
        ['?arg=1.2', 1.2],
        ['?arg=-1.2', -1.2],
        ['?arg=text', ERROR_BAD_REQUEST],
        ['?arg=[]', ERROR_BAD_REQUEST],
        ['?arg=[1,2]', ERROR_BAD_REQUEST],
        ['?arg={}', ERROR_BAD_REQUEST],
        ['?arg={"a":true}', ERROR_BAD_REQUEST],
        // Numbers larger than MAX_SAFE_INTEGER get trimmed
        ['?arg=2343546576878989879789', 2.34354657687899e+21],
        ['?arg=-2343546576878989879789', -2.34354657687899e+21],
        // Scientific notation is accepted
        ['?arg=1.234e+30', ERROR_BAD_REQUEST /* should be: 1.234e+30 */],
        ['?arg=-1.234e+30', ERROR_BAD_REQUEST /* should be: -1.234e+30 */],
      ]);
    });

    describe('number - required', function() {
      verifyTestCases({ arg: 'arg', type: 'number', required: true }, [
        [EMPTY_QUERY, ERROR_BAD_REQUEST],
        ['?arg', 0, /* should be: ERROR_BAD_REQUEST */],
        ['?arg=undefined', ERROR_BAD_REQUEST],
        ['?arg=null', ERROR_BAD_REQUEST],
        ['?arg=0', 0 ],
        ['?arg=1', 1 ],
        ['?arg=[]', ERROR_BAD_REQUEST],
        ['?arg={}', ERROR_BAD_REQUEST],
      ]);
    });

    function verifyTestCases(argSpec, testCases) {
      testCases.forEach(function(tc) {
        var queryString = tc[0];
        var expectedValue = tc[1];

        var niceInput = queryString === EMPTY_QUERY ?
          'empty query' : queryString;
        var niceExpectation = expectedValue instanceof Error ?
          'HTTP error ' + expectedValue.message :
          JSON.stringify(expectedValue);
        var testName = format('coerces %s to %s', niceInput, niceExpectation);

        it(testName, function(done) {
          testCoercion(argSpec, queryString, expectedValue, done);
        });
      });
    }

    function testCoercion(argSpec, queryString, expectedResult, done) {
      var testClass = remoteObjects.exports.testClass = {
        testMethod: function(arg, cb) {
          return cb(null, arg);
        },
      };

      extend(testClass.testMethod, {
        shared: true,
        accepts: extend(argSpec, { http: { source: 'query' } }),
        returns: { name: 'value', type: 'any' }
      });

      var uri = '/testClass/testMethod' + queryString
      var expectedStatus = expectedResult instanceof Error ?
        Number(expectedResult.message) : 200;

      request.get(uri)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          var actual = res.statusCode === 200 ?
            { value: res.body.value } :
            { error: res.statusCode };

          debug('request: %j response: %j', uri, err || actual);
          //if (err) return done(err);

          var expected = expectedResult instanceof Error ?
            { error: +expectedResult.message } :
            { value: expectedResult };

          expect(actual).to.eql(expected);
          done();
        });
    }
  });

  var server;
  function setupRemoteServer(done) {
    var app = express();
    app.use(function(req, res, next) {
      // create the handler for each request
      remoteObjects.handler('rest').apply(remoteObjects, arguments);
    });
    server = app.listen(0, '127.0.0.1', function() {
      request = supertest('http://127.0.0.1:' + this.address().port);
      done();
    });
    server.on('error', done);
  }

  function stopRemoteServer() {
    server.close();
  }

  function setupRemoteObjects() {
    remoteObjects = RemoteObjects.create();
  }

});
