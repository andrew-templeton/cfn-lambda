
var path = require('path');
var assert = require('assert');

var Server = require(path.resolve(__dirname, '..', 'test-helpers', 'https', 'server'));
var ContextStub = require(path.resolve(__dirname, '..', 'test-helpers', 'context'));

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));


describe('Severe CloudFormation Errors', function() {
  it('should still terminate lambda on signed url connection errors', function(done) {
    var expectedUrl = '/foo/bar/taco';
    var expectedStackId = 'fakeStackId';
    var expectedRequestId = 'fakeRequestId';
    var expectedLogicalResourceId = 'MyTestResource';
    function HollowRequest() {
      return {
        RequestType: 'Create',
        // Broke port intentionally!
        ResponseURL: 'https://localhost-just-kidding' + expectedUrl,
        StackId: expectedStackId,
        RequestId: expectedRequestId,
        ResourceType: 'Custom::TestResource',
        LogicalResourceId: expectedLogicalResourceId
      };
    }
    ContextStub.callback = function() {
      // means it terminated, instrumented context.done() stub.
      done();
    };
    var CfnRequest = HollowRequest();
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        reply();
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      // never hits
    });

  });


  it('should get mad when bad RequestType sent', function(done) {
    ContextStub.callback = null;
    var expectedUrl = '/foo/bar/taco';
    var expectedStackId = 'fakeStackId';
    var expectedRequestId = 'fakeRequestId';
    var expectedLogicalResourceId = 'MyTestResource';
    function HollowRequest() {
      return {
        RequestType: 'Unicorns!!',
        ResponseURL: 'https://localhost:13002' + expectedUrl,
        StackId: expectedStackId,
        RequestId: expectedRequestId,
        ResourceType: 'Custom::TestResource',
        LogicalResourceId: expectedLogicalResourceId
      };
    }
    var CfnRequest = HollowRequest();
    var expectedStatus = 'FAILED';
    var expectedPhysicalId = [
      expectedStackId,
      expectedLogicalResourceId,
      expectedRequestId
    ].join('/');
    var expectedReason = 'The impossible happend! ' +
      'CloudFormation sent an unknown RequestType.';
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
      assert(expectedReason === cfnResponse.body.Reason, 'Reason mismatch');
      done();
    });

  });
});
