
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
CfnLambdaFactory.PluckedEquality = PluckedEquality;
module.exports = CfnLambdaFactory;

function CfnLambdaFactory(resourceDefinition) {

  return function CfnLambda(event, context) {

    if (event && event.ResourceProperties) {
      delete event.ResourceProperties.ServiceToken;
    }
    if (event && event.OldResourceProperties) {
      delete event.OldResourceProperties.ServiceToken;
    }

    CfnLambdaFactory.Environment = getEnvironment(context);

    var RequestType = event.RequestType;
    var Params = event.ResourceProperties;
    var OldParams = event.OldResourceProperties;
    var RequestPhysicalId = event.PhysicalResourceId;

    console.log('REQUEST RECEIVED:\n', JSON.stringify(event));
    
    var invalidation = ValidationCheck(Params, {
      Validate: resourceDefinition.Validate,
      Schema: resourceDefinition.Schema,
      SchemaPath: resourceDefinition.SchemaPath
    });
    if (invalidation) {
      if (RequestType === 'Delete') {
        console.log('cfn-lambda: Got Delete with an invalidation, ' +
          'tripping failsafe for ROLLBACK states and exiting with success.');
        return reply();
      }
      console.log('cfn-lambda: Found an invalidation.');
      return reply(invalidation);
    } 
    if (RequestType === 'Create') {
      console.log('cfn-lambda: Delegating to Create handler.');
      return resourceDefinition.Create(Params, reply);
    }
    if (RequestType === 'Update') {
      if (JSONDeepEquals(Params, OldParams)) {
        console.log('cfn-lambda: Delegating to NoUpdate handler, ' +
        'or exiting with success (Update with unchanged params).');
        return 'function' === typeof resourceDefinition.NoUpdate
          ? resourceDefinition.NoUpdate(RequestPhysicalId, Params, reply)
          : reply(null, RequestPhysicalId);
      }
      if (Array.isArray(resourceDefinition.TriggersReplacement) &&
        !PluckedEquality(resourceDefinition.TriggersReplacement, Params, OldParams)) {
        console.log('cfn-lambda: Caught Replacement trigger key change, ' +
          'delegating to Create, Delete will be called on old resource ' +
          'during UPDATE_COMPLETE_CLEANUP_IN_PROGRESS phase.');
        return resourceDefinition.Create(Params, reply);
      }
      console.log('cfn-lambda: Delegating to Update handler.');
      return resourceDefinition.Update(RequestPhysicalId, Params, OldParams, reply);
    }
    if (RequestType === 'Delete') {
      console.log('cfn-lambda: Delegating to Delete handler.');
      return resourceDefinition.Delete(RequestPhysicalId, Params, reply);
    }
    console.log('cfn-lambda: Uh oh! Called with unrecognized EventType!');
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

function PluckedEquality(keySet, fresh, old) {
  return JSONDeepEquals(pluck(keySet, fresh), pluck(keySet, old));
}

function pluck(keySet, hash) {
  return keySet.reduce(function(plucked, key) {
    plucked[key] = hash[key];
    return plucked;
  }, {});
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
