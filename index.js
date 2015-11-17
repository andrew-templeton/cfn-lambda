
var path = require('path');

var ValidationCheck = require(path.resolve(__dirname,
  'src', 'validationCheck'));
var SDKAlias = require(path.resolve(__dirname,
  'src', 'SDKAlias'));
var JSONDeepEquals = require(path.resolve(__dirname,
  'src', 'JSONDeepEquals'));

CfnLambdaFactory.SDKAlias = SDKAlias;
CfnLambdaFactory.ValidationCheck = ValidationCheck;
CfnLambdaFactory.JSONDeepEquals = JSONDeepEquals;
module.exports = CfnLambdaFactory;

function CfnLambdaFactory(resourceDefinition) {

  return function CfnLambda(event, context) {

    if (event && event.ResourceProperties) {
      delete event.ResourceProperties.ServiceToken;
    }

    CfnLambdaFactory.Environment = getEnvironment(context);

    var RequestType = event.RequestType;
    var Params = event.ResourceProperties;
    var OldParams = event.OldResourceProperties;
    var RequestPhysicalId = event.PhysicalResourceId;
    var noUpdateChecker = typeof resourceDefinition.NoUpdate === 'function'
      ? resourceDefinition.NoUpdate
      : JSONDeepEquals;

    console.log('REQUEST RECEIVED:\n', JSON.stringify(event));
    
    var invalidation = ValidationCheck(Params, {
      Validate: resourceDefinition.Validate,
      Schema: resourceDefinition.Schema,
      SchemaPath: resourceDefinition.SchemaPath
    });
    if (invalidation && event.RequestType !== 'Delete') {
      return reply(invalidation);
    } 
    if (RequestType === 'Create') {
      return resourceDefinition.Create(Params, reply);
    }
    if (RequestType === 'Update' && noUpdateChecker(Params, OldParams)) {
      return reply();
    }
    if (RequestType === 'Update') {
      return resourceDefinition.Update(RequestPhysicalId, Params, OldParams, reply);
    }
    if (RequestType === 'Delete' && invalidation) {
      return reply();
    }
    if (RequestType === 'Delete') {
      return resourceDefinition.Delete(RequestPhysicalId, Params, reply);
    }
    return reply('The impossible happend! ' +
      'CloudFormation sent an unknown RequestType.');

    function reply(err, physicalId, optionalData) {
      if (err) {
        return sendResponse({
          Status: 'FAILED',
          Reason: err.toString(),
          PhysicalResourceId: physicalId ||
            RequestPhysicalId ||
            [event.StackId, event.LogicalResourceId, event.RequestId].join('/'),
          StackId: event.StackId,
          RequestId: event.RequestId,
          LogicalResourceId: event.LogicalResourceId,
          Data: optionalData
        });
      }
      return sendResponse({
        Status: 'SUCCESS',
        PhysicalResourceId: physicalId ||
          RequestPhysicalId ||
          [event.StackId, event.LogicalResourceId, event.RequestId].join('/'),
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: optionalData || OldParams
      });
    }

    function sendResponse(response) {

      var responseBody = JSON.stringify(response);
      
      console.log('RESPONSE: %j', response);

      var https = require('https');
      var url = require('url');
      console.log('REPLYING TO: %s', event.ResponseURL);
      var parsedUrl = url.parse(event.ResponseURL);
      var options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.path,
        rejectUnauthorized: parsedUrl.hostname !== 'localhost',
        method: 'PUT',
        headers: {
          'Content-Type': '',
          'Content-Length': responseBody.length
        }
      };

      if (parsedUrl.hostname === 'localhost') {
        options.rejectUnauthorized = false;
      }

      var request = https.request(options, function(response) {
        console.log('STATUS: %s',response.statusCode);
        console.log('HEADERS: %j', response.headers);
        response.on('data', function() {
          // noop
        });
        response.on('end', function() {
          // Tell AWS Lambda that the function execution is done  
          context.done();
        });
      });

      request.on('error', function(error) {
        console.log('sendResponse Error:\n', error);
        // Tell AWS Lambda that the function execution is done  
        context.done();
      });

      // write data to request body
      request.write(responseBody);
      request.end();
    }

  };
}

function getEnvironment(context) {
  var parsedArn = context.invokedFunctionArn.match(/^arn:aws:lambda:(\w+-\w+-\d+):(\d+):function:(.*)$/);
  return {
    LambdaArn: parsedArn[0],
    Region: parsedArn[1],
    AccountId: parsedArn[2],
    LambdaName: parsedArn[3]
  };
}
