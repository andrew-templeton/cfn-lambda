
var path = require('path');
var assert = require('assert');

var Server = require(path.resolve(__dirname, '..', 'test-helpers', 'https', 'server'));
var ContextStub = require(path.resolve(__dirname, '..', 'test-helpers', 'context'));

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));


describe('Create', function() {
  var expectedUrl = '/foo/bar/taco';
  var expectedStackId = 'fakeStackId';
  var expectedRequestId = 'fakeRequestId';
  var expectedLogicalResourceId = 'MyTestResource';
  function HollowRequest() {
    return {
      RequestType: 'Create',
      ResponseURL: 'https://localhost:13002' + expectedUrl,
      StackId: expectedStackId,
      RequestId: expectedRequestId,
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: expectedLogicalResourceId
    };
  }
  it('Should work with default generated PhysicalResourceId', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedPhysicalId = [
      expectedStackId,
      expectedLogicalResourceId,
      expectedRequestId
    ].join('/');
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply();
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(expectedPhysicalId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      done();
    });

  });

  it('Should work with a provided PhysicalResourceId', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedPhysicalId = 'someValueProvided';
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply(null, expectedPhysicalId);
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(expectedPhysicalId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      done();
    });

  });

  it('Should work with a provided Data set', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedPhysicalId = 'someValueProvided';
    var expectedData = {
      foo: 'bar'
    };
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply(null, expectedPhysicalId, expectedData);
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(expectedPhysicalId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      assert(JSON.stringify(expectedData) ===
        JSON.stringify(cfnResponse.body.Data), 'Bad Data payload');
      done();
    });

  });

  it('Should pass with good ResourceProperties', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    CfnRequest.ResourceProperties = {
      Foo: ['array', 'of', 'string', 'values']
    };
    var expectedPhysicalId = 'someValueProvided';
    var expectedData = {
      foo: 'bar'
    };
    function isString(thing) {
      return 'string' === typeof thing;
    }
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply(null, expectedPhysicalId, expectedData);
      },
      Validate: function(ResourceProperties) {
        if (!ResourceProperties ||
          !Array.isArray(ResourceProperties.Foo) ||
          !ResourceProperties.Foo.every(isString)) {
          console.log('FAILED VALIDATION: %j', ResourceProperties);
          return 'Propery Foo must be an Array of String';
        }
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(expectedPhysicalId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      assert(JSON.stringify(expectedData) ===
        JSON.stringify(cfnResponse.body.Data), 'Bad Data payload');
      done();
    });

  });

  it('Should fail with bad ResourceProperties', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'FAILED';
    CfnRequest.ResourceProperties = {
      Foo: ['array', 'of', 'NOT ALL', {string: 'values'}]
    };
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply(null, expectedPhysicalId, expectedData);
      },
      Validate: function(ResourceProperties) {
        if (!ResourceProperties ||
          !Array.isArray(ResourceProperties.Foo) ||
          !ResourceProperties.Foo.every(isString)) {
          console.log('FAILED VALIDATION: %j', ResourceProperties);
          return 'Propery Foo must be an Array of String';
        }
        function isString(thing) {
          return 'string' === typeof thing;
        }
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      done();
    });

  });

  it('Should fail with correct messaging', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'FAILED';
    var expectedReason = 'You done goofed, son!!';
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply(expectedReason);
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(expectedReason === cfnResponse.body.Reason, 'Bad error Reason');
      done();
    });

  });
});
