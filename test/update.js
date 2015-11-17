
var path = require('path');
var assert = require('assert');

var Server = require(path.resolve(__dirname, '..', 'test-helpers', 'https', 'server'));
var ContextStub = require(path.resolve(__dirname, '..', 'test-helpers', 'context'));

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));


describe('Update', function() {
  var expectedUrl = '/foo/bar/taco';
  var expectedStackId = 'fakeStackId';
  var expectedRequestId = 'fakeRequestId';
  var expectedLogicalResourceId = 'MyTestResource';
  function HollowRequest() {
    return {
      RequestType: 'Update',
      ResponseURL: 'https://localhost:13002' + expectedUrl,
      StackId: expectedStackId,
      RequestId: expectedRequestId,
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: expectedLogicalResourceId,
      PhysicalResourceId: 'someFakeId',
      OldResourceProperties: {
        Foo: ['array', 'of', 'string']
      }
    };
  }
  it('Should work with unchanged PhysicalResourceId', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var Lambda = CfnLambda({
      Update: function(PhysicalId, Params, OldParams, reply) {
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
      console.log(cfnResponse.body.PhysicalResourceId)
      assert(CfnRequest.PhysicalResourceId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      done();
    });

  });

  it('Should work with a provided PhysicalResourceId', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedPhysicalId = 'someValueProvided';
    var Lambda = CfnLambda({
      Update: function(PhysicalId, Params, OldParams, reply) {
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
      Foo: 'bar'
    };
    var Lambda = CfnLambda({
      Update: function(PhysicalId, Params, OldParams, reply) {
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
      Update: function(PhysicalId, Params, OldParams, reply) {
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
      Update: function(PhysicalId, Params, OldParams, reply) {
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
      Update: function(PhysicalId, Params, OldParams, reply) {
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

  it('Should bypass update with default NoUpdate', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedReason = 'You done goofed, son!!';
    var updateWasRun = false;
    CfnRequest.ResourceProperties = {
      Foo: ['array', 'of', 'string'] // Same value as OldResourceProperties
    };
    var Lambda = CfnLambda({
      Update: function(PhysicalId, Params, OldParams, reply) {
        updateWasRun = true;
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
      assert(!updateWasRun, 'Update ran, should not run');
      done();
    });

  });

  it('Should run custom code with custom NoUpdate', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedReason = 'You done goofed, son!!';
    var updateWasRun = false;
    var expectedAttr = 'attrs';
    CfnRequest.ResourceProperties = {
      Foo: ['array', 'of', 'string']
    };
    var Lambda = CfnLambda({
      Update: function(PhysicalId, Params, OldParams, reply) {
        updateWasRun = true;
        reply();
      },
      NoUpdate: function(PhysicalId, Params, reply) {
        setTimeout(function() {
          reply(null, PhysicalId, {
            usable: expectedAttr
          });
        });
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
      assert(CfnRequest.PhysicalResourceId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      assert(expectedAttr === cfnResponse.body.Data.usable, 'Bad attrs hash');
      assert(Object.keys(cfnResponse.body.Data).length === 1, 'Bad attrs hash');
      assert(!updateWasRun, 'Update ran, should not run');
      done();
    });

  });

  it('Should delegate to Create when triggering Replacement', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'SUCCESS';
    var expectedReason = 'You done goofed, son!!';
    var updateWasRun = false;
    var createWasRun = false;
    var expectedAttr = 'attrs';
    CfnRequest.ResourceProperties = {
      Foo: 'CHANGED',
      Bar: 'unchanged'
    };
    CfnRequest.OldResourceProperties = {
      Foo: 'ORIGINAL',
      Bar: 'unchanged'
    };
    var Lambda = CfnLambda({
      Update: function(PhysicalId, Params, OldParams, reply) {
        updateWasRun = true;
        reply();
      },
      Create: function(Params, reply) {
        createWasRun = true;
        reply();
      },
      TriggersReplacement: ['Foo']
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(CfnRequest.PhysicalResourceId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      assert(!updateWasRun, 'Update ran, should not run');
      assert(createWasRun, 'Create did not run, should run');
      done();
    });

  });
});