

var path = require('path');
var assert = require('assert');

var Server = require(path.resolve(__dirname, '..', 'test-helpers', 'https', 'server'));
var ContextStub = require(path.resolve(__dirname, '..', 'test-helpers', 'context'));

var CfnLambda = require(path.resolve(__dirname, '..', 'index'));


describe('CfnLambda#Environment', function() {
  function HollowRequest() {
    return {
      RequestType: 'Create',
      ResponseURL: 'https://localhost:13002/foo/bar/taco',
      StackId: 'fakeStackId',
      RequestId: 'fakeRequestId',
      ResourceType: 'Custom::TestResource',
      LogicalResourceId: 'MyTestResource'
    };
  }
  it('Should yield correct Environment object', function(done) {

    var expectedEnvironment = {
      LambdaArn: 'arn:aws:lambda:fake-region-1:012345678910' +
        ':function:CfnLambdaResource-TestFunction',
      Region: 'fake-region-1',
      AccountId: '012345678910',
      LambdaName: 'CfnLambdaResource-TestFunction'
    };

    var actualEnvironment;
    var Lambda = CfnLambda({
      Create: function(Params, reply) {
        actualEnvironment = CfnLambda.Environment;
        reply();
      }
    });

    Server.on(function() {
      Lambda(HollowRequest(), ContextStub);
    }, function(cfnResponse) {
      assert(actualEnvironment.LambdaArn === expectedEnvironment.LambdaArn);
      assert(actualEnvironment.Region === expectedEnvironment.Region);
      assert(actualEnvironment.AccountId === expectedEnvironment.AccountId);
      assert(actualEnvironment.LambdaName === expectedEnvironment.LambdaName);
      done();
    });

  });

});