
var path = require('path');
var assert = require('assert');
var _ = require('underscore')

var ValidationCheck = require(path.resolve(__dirname, '..', 'index')).ValidationCheck;

describe('Validation', function() {

  describe('Trivial Passing', function() {
    it('should pass when no validations are passed', function(done) {

      var invalidation = ValidationCheck({}, {});

      assert(!invalidation);
      done();

    });

    it('should pass on a trivial Validate function', function(done) {

      function trivialFunction() {}
      var invalidation = ValidationCheck({}, {
        Validate: trivialFunction
      });

      assert(!invalidation);
      done();

    });

    it('should pass on a trivial JSONSchema', function(done) {

      var trivialSchema = {
        type: 'object',
        properties: {}
      };
      var invalidation = ValidationCheck({}, {
        Schema: trivialSchema
      });

      assert(!invalidation);
      done();

    });
  });

  describe('Bad Validation Definitions', function() {
    it('should break on non-Function Validate property', function(done) {

      var badValidateProperty = 'not an Object or Function...';

      var badValidateErrorMessage = 'FATAL: Any Lambda Validate should be a function.';

      var invalidation = ValidationCheck('anything', {
        Validate: badValidateProperty
      });

      assert(invalidation === badValidateErrorMessage);
      done();
    });

    it('should break on non-plain-Object Schema property', function(done) {

      var nonObject = 'A non-object...';
      var badSchemaPropertyErrorMessage = 'FATAL: Any Lambda Schema ' +
        'should be a plain Object.';

      var invalidation = ValidationCheck('anything', {
        Schema: nonObject
      });

      assert(invalidation === badSchemaPropertyErrorMessage);
      done();
    });

    it('should break on malformed JSONSchema Schema plain Object property', function(done) {

      var badSchema = {
        type: 'terrible schema'
      };
      var badJSONSchemaErrorMessage = 'The custom resource\'s schema was an ' +
        'object, but was not valid JSONSchema v4.';

      var invalidation = ValidationCheck('anything', {
        Schema: badSchema
      });

      assert(invalidation === badJSONSchemaErrorMessage);
      done();
    });

    it('should break on non-Array SchemaPath property', function(done) {

      var nonArray = 'definitely not an array...';
      var badSchemaPathErrorMessage = 'FATAL: Any Lambda SchemaPath ' +
        'should be an Array of String.';

      var invalidation = ValidationCheck('anything', {
        SchemaPath: nonArray
      });

      assert(invalidation === badSchemaPathErrorMessage);
      done();
    });

    it('should break on non-String SchemaPath property Array elements', function(done) {

      var arrayWithNonString = ['ok', 'fine', {oopsie: 'daisy'}];
      var badSchemaPathErrorMessage = 'FATAL: Any Lambda SchemaPath ' +
        'should be an Array of String.';

      var invalidation = ValidationCheck('anything', {
        SchemaPath: arrayWithNonString
      });

      assert(invalidation === badSchemaPathErrorMessage);
      done();
    });

    it('should break on invalid JSON file for SchemaPath property', function(done) {

      var badPath = ['tmp', 'foobar.notjson'];
      var badJSONFileErrorMessage = 'FATAL: No JSON was found at SchemaPath';

      var invalidation = ValidationCheck('anything', {
        SchemaPath: badPath
      });

      assert(invalidation === badJSONFileErrorMessage);
      done();
    });

  });

  describe('Function Validation', function() {

    var myCustomValidationError  = 'Property "numbers" should be Array of Number adding to 10.';
    function myCustomValidator(params) {
      return (params &&
        Array.isArray(params.numbers) &&
        params.numbers.every(isFiniteNumber) &&
        params.numbers.reduce(plus, 0) === 10)
          ? false
          : myCustomValidationError;
      function isFiniteNumber(n) {
        return 'number' === typeof n && isFinite(n);
      }
      function plus(a, b) {
        return a + b;
      }
    }

    it('should catch bad properties', function(done) {

      var params = {
        numbers: 'taco!'
      };

      var invalidation = ValidationCheck(params, {
        Validate: myCustomValidator
      });

      assert(invalidation === myCustomValidationError);
      done();

    });

    it('should catch missing properties', function(done) {

      var params = undefined;

      var invalidation = ValidationCheck(params, {
        Validate: myCustomValidator
      });

      assert(invalidation === myCustomValidationError);
      done();

    });

    it('should pass good properties', function(done) {

      var params = {
        numbers: [1, 2, 3, 4]
      };

      var invalidation = ValidationCheck(params, {
        Validate: myCustomValidator
      });

      assert(!invalidation);
      done();

    });
  });

  describe('Schema Object Validation', function() {

    var goodSchema = {
      type: 'object',
      required: [
        'name'
      ],
      properties: {
        name: {
          type: 'string'
        },
        cloneFrom: {
          type: 'string'
        },
        description: {
          type: 'string'
        }
      }
    };

    it('should validate a good schema', function(done) {

      var goodParams = {
        name: 'myapi',
        description: 'Foobarbazqux'
      };

      var invalidation = ValidationCheck(goodParams, {
        Schema: goodSchema
      });

      assert(!invalidation);
      done();

    });

    it('should break on missing required property', function(done) {

      var missingName = {
        description: 'oops this should explode'
      };
      var missingNameError = JSON.stringify([[["property ==>","instance"],["message ==>","requires property \"name\""],["schema ==>",{"type":"object","required":["name"],"properties":{"name":{"type":"string"},"cloneFrom":{"type":"string"},"description":{"type":"string"}}}],["instance ==>",{"description":"oops this should explode"}],["name ==>","required"],["argument ==>","name"],["stack ==>","instance requires property \"name\""]]])

      var invalidation = ValidationCheck(missingName, {
        Schema: goodSchema
      });

      assert(_.isEqual(invalidation, missingNameError));
      done();

    });

    it('should break on bad type', function(done) {

      var badCloneFrom = {
        name: 'Andrew Templeton',
        cloneFrom: ['not', 'a', 'string', 'oops!']
      };
      var badCloneFromError = JSON.stringify([[["property ==>","instance.cloneFrom"],["message ==>","is not of a type(s) string"],["schema ==>",{"type":"string"}],["instance ==>",["not","a","string","oops!"]],["name ==>","type"],["argument ==>",["string"]],["stack ==>","instance.cloneFrom is not of a type(s) string"]]]);

      var invalidation = ValidationCheck(badCloneFrom, {
        Schema: goodSchema
      });

      assert(invalidation === badCloneFromError);
      done();

    });
  });

  describe('SchemaPath Object Validation', function() {

    var goodSchemaPath = [
      __dirname,
      '..',
      'test-helpers',
      'test.schema.json'
    ];

    it('should validate a good schema', function(done) {

      var goodParams = {
        name: 'myapi',
        description: 'Foobarbazqux'
      };

      var invalidation = ValidationCheck(goodParams, {
        SchemaPath: goodSchemaPath
      });

      assert(!invalidation);
      done();

    });

    it('should break on missing required property', function(done) {

      var missingName = {
        description: 'oops this should explode'
      };
      var missingNameError = JSON.stringify([[["property ==>","instance"],["message ==>","requires property \"name\""],["schema ==>",{"type":"object","required":["name"],"properties":{"name":{"type":"string"},"cloneFrom":{"type":"string"},"description":{"type":"string"}}}],["instance ==>",{"description":"oops this should explode"}],["name ==>","required"],["argument ==>","name"],["stack ==>","instance requires property \"name\""]]]);

      var invalidation = ValidationCheck(missingName, {
        SchemaPath: goodSchemaPath
      });

      assert(invalidation === missingNameError);
      done();

    });

    it('should break on bad type', function(done) {

      var badCloneFrom = {
        name: 'Andrew Templeton',
        cloneFrom: ['not', 'a', 'string', 'oops!']
      };
      var badCloneFromError = JSON.stringify([[["property ==>","instance.cloneFrom"],["message ==>","is not of a type(s) string"],["schema ==>",{"type":"string"}],["instance ==>",["not","a","string","oops!"]],["name ==>","type"],["argument ==>",["string"]],["stack ==>","instance.cloneFrom is not of a type(s) string"]]]);

      var invalidation = ValidationCheck(badCloneFrom, {
        SchemaPath: goodSchemaPath
      });

      assert(invalidation === badCloneFromError);

      done();

    });
  });

});
