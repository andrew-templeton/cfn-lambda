
var path = require('path');
var assert = require('assert');

var ValidationCheck = require(path.resolve(__dirname, '..', 'index')).ValidationCheck;

describe('Validation', function() {

  describe('Trivial Passing', function() {
    it('should pass when no Validate property is passed', function(done) {

      var invalidation = ValidationCheck({}, undefined);

      assert(!invalidation);
      done();

    });

    it('should pass on an empty function', function(done) {
      
      var invalidation = ValidationCheck({}, function() {});

      assert(!invalidation);
      done();

    });

    it('should pass on an empty JSONSchema', function(done) {

      var invalidation = ValidationCheck({}, {
        type: 'object',
        properties: {}
      });

      assert(!invalidation);
      done();

    });
  });
  
  describe('Bad Validate Definitions', function() {
    it('should break on non-Object, non-Function Validate property', function(done) {

      var badValidateProperty = 'not an Object or Function...';

      var badValidateErrorMessage = 'The custom resource Validate property was defined, ' +
        'but was neither an Object for JSONSchema validation nor a function.';

      var invalidation = ValidationCheck('anything', badValidateProperty);

      assert(invalidation === badValidateErrorMessage);
      done();
    });

    it('should break on bad JSONSchema Validate property', function(done) {

      var badSchema = {
        type: 'terrible schema'
      };
      var badSchemaErrorMessage = 'The custom resource\'s Validate property was an ' +
        'object, but was not a valid JSONSchema v4 object.';

      var invalidation = ValidationCheck('anything', badSchema);

      assert(invalidation === badSchemaErrorMessage);
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

      var invalidation = ValidationCheck(goodParams, goodSchema);

      assert(!invalidation);
      done();

    });

    it('should break on missing required property', function(done) {

      var missingName = {
        description: 'oops this should explode'
      };
      var missingNameError = 'TypeError: At path: #, had an error ' +
        '(required), expected name but got undefined.';

      var invalidation = ValidationCheck(missingName, goodSchema);

      assert(invalidation === missingNameError);
      done();

    });

    it('should break on bad type', function(done) {

      var badCloneFrom = {
        name: 'Andrew Templeton',
        cloneFrom: ['not', 'a', 'string', 'oops!']
      };
      var badCloneFromError = 'TypeError: At path: #/cloneFrom, ' +
        'had an error (type), expected string but got array.';

      var invalidation = ValidationCheck(badCloneFrom, goodSchema);

      assert(invalidation === badCloneFromError);
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

      var invalidation = ValidationCheck(params, myCustomValidator);

      assert(invalidation === myCustomValidationError);
      done();

    });

    it('should catch missing properties', function(done) {

      var params = undefined;

      var invalidation = ValidationCheck(params, myCustomValidator);

      assert(invalidation === myCustomValidationError);
      done();

    });

    it('should pass good properties', function(done) {

      var params = {
        numbers: [1, 2, 3, 4]
      };

      var invalidation = ValidationCheck(params, myCustomValidator);

      assert(!invalidation);
      done();

    });
  });

});
