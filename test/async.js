
var path = require('path');
var assert = require('assert');

var Server = require(path.resolve(__dirname, '..', 'test-helpers', 'https', 'server'));
var ContextStub = require(path.resolve(__dirname, '..', 'test-helpers', 'context'));
var CfnLambda = require(path.resolve(__dirname, '..', 'index'));

describe('Async support', function() {
  var expectedUrl = '/foo/bar/taco';
  var expectedStackId = 'fakeStackId';
  var expectedRequestId = 'fakeRequestId';
  var expectedLogicalResourceId = 'MyTestResource';
  function HollowCreateRequest() {
    return {
      RequestType: 'Create',
      ResponseURL: 'https://localhost:13002' + expectedUrl,
      StackId: expectedStackId,
      RequestId: expectedRequestId,
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: expectedLogicalResourceId,
      ResourceProperties: {
        Foo: 'Bar'
      }
    };
  }
  function HollowUpdateRequest() {
    return {
      RequestType: 'Update',
      ResponseURL: 'https://localhost:13002' + expectedUrl,
      StackId: expectedStackId,
      RequestId: expectedRequestId,
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: expectedLogicalResourceId,
      PhysicalResourceId: 'someFakeId',
      ResourceProperties: {
        Foo: 'Bar'
      },
      OldResourceProperties: {
        Foo: 'Boo'
      }
    };
  }
  function HollowDeleteRequest() {
    return {
      RequestType: 'Delete',
      ResponseURL: 'https://localhost:13002' + expectedUrl,
      StackId: expectedStackId,
      RequestId: expectedRequestId,
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: expectedLogicalResourceId,
      PhysicalResourceId: 'someFakeId',
      ResourceProperties: {
        Foo: 'Bar'
      }
    };
  }
  function wait() {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        resolve();
      }, 50);
    });
  }
  it('Should send error.messge to CloudFormation', function(done) {
    var CfnRequest = HollowCreateRequest();
    var errorMessage = 'Worked, it did not';
    var Lambda = CfnLambda({
      AsyncCreate: async function() {
        throw new Error(errorMessage);
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(cfnResponse.body.Status === 'FAILED', 'Failed but replied with SUCCESS status');
      assert(cfnResponse.body.Reason === errorMessage, 'Error message doesnt match');
      // test would fail after 2s timeout if reply() callback is never called
      done();
    });
  });
  it('Should reply to server with response values when using AsyncCreate', function(done) {
    var CfnRequest = HollowCreateRequest();
    var response = {
      PhysicalResourceId: 'yopadope',
      FnGetAttrsDataObj: {
        MyObj: 'dopeayope'
      }
    };
    var Lambda = CfnLambda({
      AsyncCreate: async function(Params) {
        assert(Params.Foo === 'Bar', 'ResourceProperty Foo doesnt match');
        await wait();
        return response;
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(cfnResponse.body.Status === 'SUCCESS', 'Did not reply with SUCCESS status');
      assert(cfnResponse.body.PhysicalResourceId === response.PhysicalResourceId, 'PhysicalResourceId doesnt match');
      assert(cfnResponse.body.Data.MyObj === response.FnGetAttrsDataObj.MyObj, 'FnGetAttrsDataObj doesnt match');
      // test would fail after 2s timeout if reply() callback is never called
      done();
    });
  });
  it('Should reply to server with response values when using AsyncDelete', function(done) {
    var CfnRequest = HollowDeleteRequest();
    var response = {
      PhysicalResourceId: 'yopadope',
      FnGetAttrsDataObj: {
        MyObj: 'dopeayope'
      }
    };
    var Lambda = CfnLambda({
      AsyncDelete: async function(PhysicalId, Params) {
        assert(PhysicalId === 'someFakeId', 'PhysicalId doesnt match');
        assert(Params.Foo === 'Bar', 'ResourceProperty Foo doesnt match');
        await wait();
        return response;
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(cfnResponse.body.Status === 'SUCCESS', 'Did not reply with SUCCESS status');
      assert(cfnResponse.body.PhysicalResourceId === response.PhysicalResourceId, 'PhysicalResourceId doesnt match');
      assert(cfnResponse.body.Data.MyObj === response.FnGetAttrsDataObj.MyObj, 'FnGetAttrsDataObj doesnt match');
      // test would fail after 2s timeout if reply() callback is never called
      done();
    });
  });
  it('Should reply to server with response values when using AsyncUpdate', function(done) {
    var CfnRequest = HollowUpdateRequest();
    var response = {
      PhysicalResourceId: 'yopadope',
      FnGetAttrsDataObj: {
        MyObj: 'dopeayope'
      }
    };
    var Lambda = CfnLambda({
      AsyncUpdate: async function(PhysicalId, Params, OldParams) {
        assert(PhysicalId === 'someFakeId', 'PhysicalId doesnt match');
        assert(Params.Foo === 'Bar', 'ResourceProperty Foo doesnt match');
        assert(OldParams.Foo === 'Boo', 'OldResourceProperty Foo doesnt match');
        await wait();
        return response;
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(cfnResponse.body.Status === 'SUCCESS', 'Did not reply with SUCCESS status');
      assert(cfnResponse.body.PhysicalResourceId === response.PhysicalResourceId, 'PhysicalResourceId doesnt match');
      assert(cfnResponse.body.Data.MyObj === response.FnGetAttrsDataObj.MyObj, 'FnGetAttrsDataObj doesnt match');
      // test would fail after 2s timeout if reply() callback is never called
      done();
    });
  });
  it('Should reply to server with response values when using AsyncNoUpdate', function(done) {
    var CfnRequest = HollowUpdateRequest();
    CfnRequest.ResourceProperties = {
      Foo: 'Boo' // Same value as OldResourceProperties
    };
    var response = {
      PhysicalResourceId: 'yopadope',
      FnGetAttrsDataObj: {
        MyObj: 'dopeayope'
      }
    };
    var Lambda = CfnLambda({
      AsyncNoUpdate: async function(PhysicalId, Params) {
        assert(PhysicalId === 'someFakeId', 'PhysicalId doesnt match');
        assert(Params.Foo === 'Boo', 'ResourceProperty Foo doesnt match');
        await wait();
        return response;
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(cfnResponse.body.Status === 'SUCCESS', 'Did not reply with SUCCESS status');
      assert(cfnResponse.body.PhysicalResourceId === response.PhysicalResourceId, 'PhysicalResourceId doesnt match');
      assert(cfnResponse.body.Data.MyObj === response.FnGetAttrsDataObj.MyObj, 'FnGetAttrsDataObj doesnt match');
      // test would fail after 2s timeout if reply() callback is never called
      done();
    });
  });
  it('Should prioritize regular Create over AsyncCreate', function(done) {
    var CfnRequest = HollowCreateRequest();
    var asyncCalled = false;
    var regularCalled = false;
    var Lambda = CfnLambda({
      AsyncCreate: function(Params) {
        asyncCalled = true;
      },
      Create: function(Params, reply) {
        regularCalled = true;
        reply();
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(asyncCalled === false, 'Should not call async version');
      assert(regularCalled === true, 'Should call regular version');
      done();
    });
  });
  it('Should prioritize regular Delete over AsyncDelete', function(done) {
    var CfnRequest = HollowDeleteRequest();
    var asyncCalled = false;
    var regularCalled = false;
    var Lambda = CfnLambda({
      AsyncDelete: function(PhysicalId, Params) {
        asyncCalled = true;
      },
      Delete: function(PhysicalId, Params, reply) {
        regularCalled = true;
        reply();
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(asyncCalled === false, 'Should not call async version');
      assert(regularCalled === true, 'Should call regular version');
      done();
    });
  });
  it('Should prioritize regular Update over AsyncUpdate', function(done) {
    var CfnRequest = HollowUpdateRequest();
    var asyncCalled = false;
    var regularCalled = false;
    var Lambda = CfnLambda({
      AsyncUpdate: function(PhysicalId, Params, OldParams) {
        asyncCalled = true;
      },
      Update: function(PhysicalId, Params, OldParams, reply) {
        regularCalled = true;
        reply();
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(asyncCalled === false, 'Should not call async version');
      assert(regularCalled === true, 'Should call regular version');
      done();
    });
  });
  it('Should prioritize regular NoUpdate over AsyncNoUpdate', function(done) {
    var CfnRequest = HollowUpdateRequest();
    CfnRequest.ResourceProperties = {
      Foo: 'Boo' // Same value as OldResourceProperties
    };
    var asyncCalled = false;
    var regularCalled = false;
    var Lambda = CfnLambda({
      AsyncNoUpdate: function(PhysicalId, Params) {
        asyncCalled = true;
      },
      NoUpdate: function(PhysicalId, Params, reply) {
        regularCalled = true;
        reply();
      }
    });
    Server.on(function() {
      Lambda(CfnRequest, ContextStub);
    }, function(cfnResponse) {
      assert(asyncCalled === false, 'Should not call async version');
      assert(regularCalled === true, 'Should call regular version');
      done();
    });
  });
});
