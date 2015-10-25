
module.exports = CfnLambdaFactory;

function CfnLambdaFactory(resourceDefinition) {

  return function CfnLambda(event, context) {

    var RequestType = event.RequestType;
    var Params = event.ResourceProperties;
    var OldParams = event.OldResourceProperties;
    var noUpdateChecker = typeof resourceDefinition.NoUpdate === 'function'
      ? resourceDefinition.NoUpdate
      : objectPerfectEqualityByJSON;

    console.log('REQUEST RECEIVED:\n', JSON.stringify(event));
    
    var invalidation = resourceDefinition.Validate(Params);
    if (invalidation && event.RequestType !== 'Delete') {
      return reply(invalidation);
    } 
    if (RequestType === 'Create') {
      return resourceDefinition.Create(event.ResourceProperties, reply);
    }
    if (RequestType === 'Update' && noUpdateChecker(Params, OldParams)) {
      return reply();
    }
    if (RequestType === 'Update') {
      return resourceDefinition.Update(event.ResourceProperties, event.OldResourceProperties, reply);
    }
    if (RequestType === 'Delete' && invalidation) {
      return reply();
    }
    if (RequestType === 'Delete') {
      return resourceDefinition.Delete(event.ResourceProperties, reply);
    }
    return reply('The impossible happend! ' +
      'CloudFormation sent an unknown RequestType.');

    function reply(err, physicalId, optionalData) {
      if (err) {
        return sendResponse({
          Status: 'FAILED',
          Reason: (err || 'UNKNOWN FAILURE').toString(),
          PhysicalResourceId: physicalId || event.PhysicalResourceId,
          StackId: event.StackId,
          RequestId: event.RequestId,
          LogicalResourceId: event.LogicalResourceId,
          Data: optionalData
        });
      }
      return sendResponse({
        Status: 'SUCCESS',
        PhysicalResourceId: physicalId || event.PhysicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: optionalData
      });
    }

    function sendResponse(response) {

      var responseBody = JSON.stringify(response);
      
      console.log('RESPONSE BODY:\n', responseBody);

      var https = require('https');
      var url = require('url');
      console.log('REPLYING TO: ', event.ResponseUrl);
      var parsedUrl = url.parse(event.ResponseUrl);
      var options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': responseBody.length
        }
      };

      var request = https.request(options, function(response) {
        console.log('STATUS: ' + response.statusCode);
        console.log('HEADERS: ' + JSON.stringify(response.headers));
        // Tell AWS Lambda that the function execution is done  
        context.done();
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

function objectPerfectEqualityByJSON(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

