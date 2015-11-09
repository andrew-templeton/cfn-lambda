
var path = require('path');
var assert = require('assert');

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));


describe('Sanity', function() {
  it('should produce a lambda handler when provided object', function() {
    var resource = {};
    var lambda = CfnLambda(resource);
    assert('function' == typeof lambda);
    assert(lambda.length == 2);
  });
});
