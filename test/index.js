
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
