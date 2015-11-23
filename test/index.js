
var path = require('path');
var assert = require('assert');

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));
var JSONDeepEquals = CfnLambda.JSONDeepEquals;

describe('Sanity', function() {
  it('should produce a lambda handler when provided object', function() {
    var resource = {};
    var lambda = CfnLambda(resource);
    assert('function' == typeof lambda);
    assert(lambda.length == 2);
  });
});

describe('JSONDeepEquals', function() {
  describe('Array types', function(done) {
    it('should check actual array types on primitive elements', function(done) {
      var a = [
        0,
        1,
        2
      ];
      var b = {
        '0': 0,
        '1': 1,
        '2': 2
      };
      assert(!JSONDeepEquals(a, b));
      done();
    });
    it('should check actual array types on complex elements', function(done) {
      var a = [
        0, 
        {
          foo: 'bar'
        },
        2
      ];
      var b = {
        '0': 0,
        '1': {
          foo: 'bar'
        },
        '2': 2
      };
      assert(!JSONDeepEquals(a, b));
      done();
    });
    it('should check actual array types on complex objects', function(done) {
      var a = {
        "Baz": "Qux",
        "DeepExpansion": {
          "Arr": {
            "0": {
              "Existing": "Element"
            },
            "1": {
              "deepest": "variable",
              "Foo": "Bar",
              "Overlap": "NewValue"
            }
          }
        }
      };
      var b = {
        "Baz": "Qux",
        "DeepExpansion": {
          "Arr": [
            {
              "Existing": "Element"
            },
            {
              "Foo": "Bar",
              "Overlap": "NewValue",
              "deepest": "variable"
            }
          ]
        }
      };
      assert(!JSONDeepEquals(a, b));
      done();
    });
  });
  describe('NaN equality corner cases', function() {
    it('should find that NaNs are equal', function(done) {
      var a = {
        foo: NaN
      };
      var b = {
        foo: NaN
      };
      assert(JSONDeepEquals(a, b));
      done();
    });
    it('should find that single NaNs are unequal', function(done) {
      var a = {
        foo: NaN
      };
      var b = {
        foo: -0
      };
      assert(!JSONDeepEquals(a, b));
      done();
    });
  });
});
