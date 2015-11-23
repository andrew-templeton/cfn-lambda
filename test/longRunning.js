
var path = require('path');
var assert = require('assert');

var Server = require(path.resolve(__dirname, '..', 'test-helpers', 'https', 'server'));
var ContextStub = require(path.resolve(__dirname, '..', 'test-helpers', 'context'));

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));




describe('LongRunning', function() {
  var expectedUrl = '/foo/bar/taco';
  var expectedStackId = 'fakeStackId';
  var expectedRequestId = 'fakeRequestId';
  var expectedLogicalResourceId = 'MyTestResource';
  function HollowRequest() {
    return {
      ResponseURL: 'https://localhost:13002' + expectedUrl,
      StackId: expectedStackId,
      RequestId: expectedRequestId,
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: expectedLogicalResourceId
    };
  }
  it('should die when exceeding MaxPings', function(done) {
    var CfnRequest = HollowRequest();
    var expectedStatus = 'FAILED';
    var expectedPhysicalId = [
      expectedStackId,
      expectedLogicalResourceId,
      expectedRequestId
    ].join('/');
    var Lambda = CfnLambda({
      LongRunning: {
        MaxPings: 2,
        PingInSeconds: 60
      }
    });
    var expectedMaxPingError = 'FATAL: LongRunning resource failed ' +
      'to stabilize within MaxPings (2 of 60 seconds each)';

    CfnRequest.RequestType = 'Create';
    CfnRequest.LongRunningRequestContext = {
      PassedPings: 2
    };

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(expectedUrl === cfnResponse.url, 'Bad publish URL');
      assert(expectedStatus === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(expectedPhysicalId === cfnResponse.body.PhysicalResourceId, 'Bad PhysicalResourceId');
      assert(expectedMaxPingError === cfnResponse.body.Reason, 'Bad PingMax failure message: ' + cfnResponse.body.Reason);
      done();
    });

  });

  it('should call LongRunning.Methods.Create when Create + non-exceeded PingMax', function(done) {
    var CfnRequest = HollowRequest();
    var expectedPhysicalId = 'foobar';
    CfnRequest.RequestType = 'Create';
    CfnRequest.LongRunningRequestContext = {
      PassedPings: 1
    };
    var expectedStatus = 'SUCCESS';
    var expectedPhysicalId = 'someValueProvided';
    var Lambda = CfnLambda({
      LongRunning: {
        PingInSeconds: 60,
        MaxPings: 2,
        Methods: {
          Create: function(rawContext, params, reply) {
            assert(rawContext.PassedPings === 1, 'Did not receieve LongRunningRequestContext');
            reply(null, expectedPhysicalId);
          }
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
      done();
    });

  });

  it('should call LongRunning.Methods.Delete when Delete + non-exceeded PingMax', function(done) {
    var CfnRequest = HollowRequest();
    var expectedPhysicalId = 'foobar';
    CfnRequest.RequestType = 'Delete';
    CfnRequest.LongRunningRequestContext = {
      PassedPings: 1
    };
    var expectedStatus = 'SUCCESS';
    var Lambda = CfnLambda({
      LongRunning: {
        PingInSeconds: 60,
        MaxPings: 2,
        Methods: {
          Delete: function(rawContext, physicalId, params, reply) {
            assert(rawContext.PassedPings === 1, 'Did not receieve LongRunningRequestContext');
            reply(null, expectedPhysicalId);
          }
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
      done();
    });

  });

  it('should call LongRunning.Methods.Update when Update + non-exceeded PingMax', function(done) {
    var CfnRequest = HollowRequest();
    var expectedPhysicalId = 'foobar';
    CfnRequest.RequestType = 'Update';
    CfnRequest.LongRunningRequestContext = {
      PassedPings: 1
    };
    var expectedStatus = 'SUCCESS';
    var Lambda = CfnLambda({
      LongRunning: {
        PingInSeconds: 60,
        MaxPings: 2,
        Methods: {
          Update: function(rawContext, physicalId, params, oldParams, reply) {
            assert(rawContext.PassedPings === 1, 'Did not receieve LongRunningRequestContext');
            reply(null, expectedPhysicalId);
          }
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
      done();
    });

  });

  it('should delegate to NormalHandler when FAILED in normal CRUD even with LongRunning configured', function(done) {
    var CfnRequest = HollowRequest();
    var expectedReason = 'Random Error to trigger failure';
    CfnRequest.RequestType = 'Create';
    var expectedStatus = 'FAILED';
    var Lambda = CfnLambda({
      Create: function(params, reply) {
        reply(expectedReason);
      },
      LongRunning: {
        PingInSeconds: 60,
        MaxPings: 2,
        LambdaApi: {},
        Methods: {
          Create: function(rawContext, params, reply) {
            // Doesn't matter, never hits in this test, just need a function here.
            throw new Error('SHOULD NOT HIT THIS CREATE PINGBACK FUNCTION');
          }
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
      assert(expectedReason === cfnResponse.body.Reason, 'Bad Reason');
      done();
    });

  });

  it('should hit LambdaApi.invoke on SUCCESS w/ normal CRUD w/ LongRunning configured', function(done) {
    var CfnRequest = HollowRequest();
    var expectedReason = 'Random Error to trigger failure';
    var expectedPhysicalId = 'foobar';
    CfnRequest.RequestType = 'Create';
    var expectedStatus = 'SUCCESS';
    var signalStart = Date.now();
    var pingDelaySeconds = 1;
    var Lambda = CfnLambda({
      Create: function(params, reply) {
        reply(null, expectedPhysicalId);
      },
      LongRunning: {
        PingInSeconds: pingDelaySeconds,
        MaxPings: 2,
        LambdaApi: {
          invoke: function(rawInvocation, respondToSpawningLambda) {
            var elapsedMillis = Date.now() - signalStart;
            var invocation = JSON.parse(rawInvocation.Payload);
            var rawResponse = invocation.LongRunningRequestContext.RawResponse;
            assert(elapsedMillis > pingDelaySeconds * 1000);
            assert(CfnRequest.ResponseURL === invocation.ResponseURL, 'Bad publish URL: ' + invocation.ResponseURL);
            assert(expectedStatus === rawResponse.Status, 'Bad Status');
            assert(expectedStackId === rawResponse.StackId, 'Bad StackID');
            assert(expectedRequestId === rawResponse.RequestId, 'Bad RequestId');
            assert(expectedLogicalResourceId === rawResponse.LogicalResourceId, 'Bad LogicalResourceId');
            assert(expectedPhysicalId === rawResponse.PhysicalResourceId);
            assert(invocation.LongRunningRequestContext.PassedPings === 0);
            assert(rawInvocation.FunctionName === ContextStub.invokedFunctionArn);
            respondToSpawningLambda(null, {
              statusCode: 202,
              message: ''
            });
          }
        },
        Methods: {
          Create: function(rawContext, params, reply) {
            // Doesn't matter, never hits in this test, just need a function here.
            throw new Error('SHOULD NOT HIT THIS CREATE PINGBACK FUNCTION');
          }
        }
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, {
        done: function() {
          done();
        },
        invokedFunctionArn: ContextStub.invokedFunctionArn
      });
    }, function(cfnResponse) {
      throw new Error('SHOULD NOT HIT S3 STUB');
    });

  });

  it('should handle LambdaApi.invoke failures as hard FAILED to S3 requests', function(done) {
    var CfnRequest = HollowRequest();
    var expectedReason = 'Random Error to trigger failure';
    var expectedPhysicalId = 'foobar';
    CfnRequest.RequestType = 'Create';
    var expectedStatus = 'SUCCESS';
    var signalStart = Date.now();
    var pingDelaySeconds = 1;
    var Lambda = CfnLambda({
      Create: function(params, reply) {
        reply(null, expectedPhysicalId);
      },
      LongRunning: {
        PingInSeconds: pingDelaySeconds,
        MaxPings: 2,
        LambdaApi: {
          invoke: function(rawInvocation, respondToSpawningLambda) {
            var elapsedMillis = Date.now() - signalStart;
            var invocation = JSON.parse(rawInvocation.Payload);
            var rawResponse = invocation.LongRunningRequestContext.RawResponse;
            assert(elapsedMillis > pingDelaySeconds * 1000);
            assert(CfnRequest.ResponseURL === invocation.ResponseURL, 'Bad publish URL: ' + invocation.ResponseURL);
            assert(expectedStatus === rawResponse.Status, 'Bad Status');
            assert(expectedStackId === rawResponse.StackId, 'Bad StackID');
            assert(expectedRequestId === rawResponse.RequestId, 'Bad RequestId');
            assert(expectedLogicalResourceId === rawResponse.LogicalResourceId, 'Bad LogicalResourceId');
            assert(expectedPhysicalId === rawResponse.PhysicalResourceId);
            assert(invocation.LongRunningRequestContext.PassedPings === 0);
            assert(rawInvocation.FunctionName === ContextStub.invokedFunctionArn);
            respondToSpawningLambda({
              statusCode: 500,
              message: 'You suck!'
            });
          }
        },
        Methods: {
          Create: function(rawContext, params, reply) {
            // Doesn't matter, never hits in this test, just need a function here.
            throw new Error('SHOULD NOT HIT THIS CREATE PINGBACK FUNCTION');
          }
        }
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert('FAILED' === cfnResponse.body.Status, 'Bad Status');
      assert(expectedStackId === cfnResponse.body.StackId, 'Bad StackID');
      assert(expectedRequestId === cfnResponse.body.RequestId, 'Bad RequestId');
      assert(expectedLogicalResourceId === cfnResponse.body.LogicalResourceId, 'Bad LogicalResourceId');
      assert(cfnResponse.body.Reason === 'Was unable to trigger long running ' +
        'pingback step: You suck!', 'Bad Reason: ' + cfnResponse.body.Reason);
      done();
    });

  });

    it('should handle LambdaApi.invoke failures as hard FAILED to S3 requests', function(done) {
    var CfnRequest = HollowRequest();
    var expectedReason = 'Random Error to trigger failure';
    var expectedPhysicalId = 'foobar';
    CfnRequest.RequestType = 'Create';
    CfnRequest.LongRunningRequestContext = {
      PassedPings: 1,
      RawResponse: {
        Status: 'SUCCESS',
        StackId: CfnRequest.StackId,
        RequestId: CfnRequest.RequestId,
        LogicalResourceId: CfnRequest.LogicalResourceId,
        PhysicalResourceId: expectedPhysicalId
      }
    };
    var expectedStatus = 'SUCCESS';
    var signalStart = Date.now();
    var pingDelaySeconds = 1;
    var Lambda = CfnLambda({
      Create: function(params, reply) {
        reply(null, expectedPhysicalId);
      },
      LongRunning: {
        PingInSeconds: pingDelaySeconds,
        MaxPings: 2,
        LambdaApi: {
          invoke: function(rawInvocation, respondToSpawningLambda) {
            var elapsedMillis = Date.now() - signalStart;
            var invocation = JSON.parse(rawInvocation.Payload);
            var rawResponse = invocation.LongRunningRequestContext.RawResponse;
            assert(elapsedMillis > pingDelaySeconds * 1000);
            assert(CfnRequest.ResponseURL === invocation.ResponseURL, 'Bad publish URL: ' + invocation.ResponseURL);
            assert(expectedStatus === rawResponse.Status, 'Bad Status');
            assert(expectedStackId === rawResponse.StackId, 'Bad StackID');
            assert(expectedRequestId === rawResponse.RequestId, 'Bad RequestId');
            assert(expectedLogicalResourceId === rawResponse.LogicalResourceId, 'Bad LogicalResourceId');
            assert(expectedPhysicalId === rawResponse.PhysicalResourceId, 'Bad PhysicalResourceId');
            assert(invocation.LongRunningRequestContext.PassedPings === 2, 'Did not increase PassedPings');
            assert(rawInvocation.FunctionName === ContextStub.invokedFunctionArn, 'Broke Lambda ARN');
            respondToSpawningLambda(null, {
              statusCode: 202,
              message: ''
            });
            done();
          }
        },
        Methods: {
          Create: function(rawContext, params, reply, notDone) {
            // Doesn't matter, never hits in this test, just need a function here.
            notDone();
          }
        }
      }
    });

    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      throw new Error('SHOULD NOT GET TO S3 SIGNED PUT!');
    });

  });

});
