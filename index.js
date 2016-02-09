
var path = require('path');

var ValidationCheck = require(path.resolve(__dirname,
  'src', 'validationCheck'));
var SDKAlias = require(path.resolve(__dirname,
  'src', 'SDKAlias'));
var JSONDeepEquals = require(path.resolve(__dirname,
  'src', 'JSONDeepEquals'));
var DefaultExpander = require(path.resolve(__dirname,
  'src', 'DefaultExpander'));
var Composite = require(path.resolve(__dirname,
  'src', 'Composite'));

CfnLambdaFactory.SDKAlias = SDKAlias;
CfnLambdaFactory.ValidationCheck = ValidationCheck;
CfnLambdaFactory.JSONDeepEquals = JSONDeepEquals;
CfnLambdaFactory.PluckedEquality = PluckedEquality;
CfnLambdaFactory.DefaultExpander = DefaultExpander;
CfnLambdaFactory.Composite = Composite;
CfnLambdaFactory.Module = Composite.Module;
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
    var Params = event.ResourceProperties &&
      DefaultExpander(event.ResourceProperties);
    var OldParams = event.OldResourceProperties &&
      DefaultExpander(event.OldResourceProperties);
    var RequestPhysicalId = event.PhysicalResourceId;
    var NormalReply = replyWithFunctor(sendResponse);

    console.log('REQUEST RECEIVED:\n', JSON.stringify(event));

    function replyOrLongRunning() {
      var longRunningConf = resourceDefinition.LongRunning;
      console.log('Checking for long running configs...');
      if (longRunningConf &&
        longRunningConf.PingInSeconds &&
        longRunningConf.MaxPings &&
        longRunningConf.LambdaApi &&
        longRunningConf.Methods && 
        'function' === typeof longRunningConf.Methods[RequestType]) {
          console.log('Long running configurations found, ' +
            'providing this callback instead of the normal reply ' +
            'to CloudFormation for action %s.', RequestType);
          console.log('LongRunning configs: %j', longRunningConf);
          return replyWithFunctor(triggerLongRunningReply);
        }
      console.log('Did not find valid LongRunning configs, ' +
        'proceed as normal req: %j', longRunningConf);
      return NormalReply;
    }

    if (event.LongRunningRequestContext) {
      console.log('LongRunningRequestContext found, proceeding ' +
        'with ping cycle logic: %j', event.LongRunningRequestContext);
      if (resourceDefinition.LongRunning &&
        resourceDefinition.LongRunning.MaxPings <=
        event.LongRunningRequestContext.PassedPings) {
          console.error('Ping cycle on long running resource ' +
            'checks exceeded, timeout failure.');
          return NormalReply('FATAL: LongRunning resource failed ' +
            'to stabilize within MaxPings (' +
            resourceDefinition.LongRunning.MaxPings + ' of ' +
            resourceDefinition.LongRunning.PingInSeconds + ' seconds each)');
        }
      console.log('Inside LongRunning request ping cycle and not timed out, ' +
        'diverting %s to handler with notDone callback supplied.', RequestType);
      if (RequestType === 'Create') {
        return resourceDefinition.LongRunning.Methods.Create(
          event.LongRunningRequestContext,
          Params,
          NormalReply,
          notDoneCallback);
      } else if (RequestType === 'Update') {
        return resourceDefinition.LongRunning.Methods.Update(
          event.LongRunningRequestContext,
          RequestPhysicalId,
          Params,
          OldParams,
          NormalReply,
          notDoneCallback);
      } else {
        return resourceDefinition.LongRunning.Methods.Delete(
          event.LongRunningRequestContext,
          RequestPhysicalId,
          Params,
          NormalReply,
          notDoneCallback);
      }
    }

    function notDoneCallback() {
      console.log('Got NotDone signal callback from implementation of ' +
        'cfn-lambda resource, engaging another tick in the cycle.');
      triggerLongRunningReply(event.LongRunningRequestContext.RawResponse);
    }

    function triggerLongRunningReply(rawReplyResponse) {
      if (rawReplyResponse.Status === 'FAILED') {
        return sendResponse(rawReplyResponse);
      }
      console.log('Long running configurations found and ' +
        'initialization sent SUCCESS, continuing with ' +
        'recurse operation: %j', rawReplyResponse);
      event.LongRunningRequestContext = {
        RawResponse: rawReplyResponse,
        PhysicalResourceId: rawReplyResponse.PhysicalResourceId,
        Data: rawReplyResponse.Data,
        PassedPings: event.LongRunningRequestContext
          ? event.LongRunningRequestContext.PassedPings + 1
          : 0
      };
      console.log('In %s seconds, will recurse with event: %j',
        resourceDefinition.LongRunning.PingInSeconds, event);
      setTimeout(function() {
        console.log('PingInSeconds of %s seconds passed, recursing lambda with: %j',
          resourceDefinition.LongRunning.PingInSeconds, event);
        resourceDefinition.LongRunning.LambdaApi.invoke({
          FunctionName: CfnLambdaFactory.Environment.LambdaArn,
          InvocationType: 'Event',
          // Still CloudWatch logs, just not req/res here
          LogType: 'None',
          Payload: JSON.stringify(event)
        }, function(invokeErr, invokeData) {
          if (invokeErr) {
            console.error('Was unable to trigger long running ' +
              'pingback step: %j', invokeErr.message);
            return NormalReply('Was unable to trigger long running ' +
              'pingback step: ' + invokeErr.message);
          }
          console.log('Triggered long running ping step: %j', invokeData);
          console.log('Terminating this lambda and allowing ' +
            ' lambda recursion to take over.');
          context.done();
        });
      }, resourceDefinition.LongRunning.PingInSeconds * 1000);
    };
    
    var invalidation = ValidationCheck(Params, {
      Validate: resourceDefinition.Validate,
      Schema: resourceDefinition.Schema,
      SchemaPath: resourceDefinition.SchemaPath
    });
    if (invalidation) {
      if (RequestType === 'Delete') {
        console.log('cfn-lambda: Got Delete with an invalidation, ' +
          'tripping failsafe for ROLLBACK states and exiting with success.');
        return NormalReply();
      }
      console.log('cfn-lambda: Found an invalidation.');
      return NormalReply(invalidation);
    } 
    if (RequestType === 'Create') {
      console.log('cfn-lambda: Delegating to Create handler.');
      return resourceDefinition.Create(Params, replyOrLongRunning('Create'));
    }
    if (RequestType === 'Update') {
      if (JSONDeepEquals(Params, OldParams)) {
        console.log('cfn-lambda: Delegating to NoUpdate handler, ' +
        'or exiting with success (Update with unchanged params).');
        return 'function' === typeof resourceDefinition.NoUpdate
          ? resourceDefinition.NoUpdate(RequestPhysicalId, Params, NormalReply)
          : NormalReply(null, RequestPhysicalId);
      }
      if (Array.isArray(resourceDefinition.TriggersReplacement) &&
        !PluckedEquality(resourceDefinition.TriggersReplacement, Params, OldParams)) {
        console.log('cfn-lambda: Caught Replacement trigger key change, ' +
          'delegating to Create, Delete will be called on old resource ' +
          'during UPDATE_COMPLETE_CLEANUP_IN_PROGRESS phase.');
        return resourceDefinition.Create(Params, replyOrLongRunning('Create'));
      }
      console.log('cfn-lambda: Delegating to Update handler.');
      return resourceDefinition.Update(RequestPhysicalId,
        Params, OldParams, replyOrLongRunning('Update'));
    }
    if (RequestType === 'Delete') {
      console.log('cfn-lambda: Delegating to Delete handler.');
      return resourceDefinition.Delete(RequestPhysicalId, Params, replyOrLongRunning('Delete'));
    }
    console.log('cfn-lambda: Uh oh! Called with unrecognized EventType!');
    return NormalReply('The impossible happend! ' +
      'CloudFormation sent an unknown RequestType.');


    function replyWithFunctor(functor) {
      return function(err, physicalId, optionalData) {
        if (err) {
          return functor({
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
        return functor({
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

module.exports.deploy = require(path.resolve(__dirname,
  'deploy'));