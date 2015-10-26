
# cfn-lambda


## Purpose

A simple flow for generating Lambda handlers in node.js. Adding IAM roles and uploading function code body is the responsibilty of the developer. The scope of this module is to structure the way developers author simple Lambda resources into simple functional definitions of Create, Update, Delete, Validate (cfn Properties), and NoUpdate (noop detection on Update).

## Full Example

See `example` subdirectory for a custom resource that applies bucket notifications to S3 buckets that need publishing of events directly to an SQS queue.

## Usage

This is a contrived example call to fully demonstrate the way to interface with the creation API.

#### Top-Level Handler Generation
```
var CfnLambda = require('cfn-lambda');

// All properties required except for NoUpdate handler.
// Scroll below to see how each handler is defined.

exports.handler = CfnLambda({
  Create: Create,
  Update: Update,
  Delete: Delete,
  Validate: Validate,
  NoUpdate: NoUpdate
});
```

#### `Create` Method Handler

Called when CloudFormation issues a `'CREATE'` command.  
Accepts the `CfnRequestParams` Properties object, and the `reply` callback.

```
function Create(CfnRequestParams, reply) {
  // code...
  if (err) {
    // Will fail the create.
    // err should be informative for Cfn template developer.
    return reply(err);
  }
  // Will pass the create.
  // physicalResourceId defaults to the request's `[StackId, LogicalResourceId, RequestId].join('/')`.
  // FnGetAttrsDataObj is optional.
  reply(null, physicalResourceId, FnGetAttrsDataObj);
}
```
#### `Update` Method Handler

Called when CloudFormation issues an `'UPDATE'` command.  
Accepts the `RequestPhysicalId` `String`, `CfnRequestParams` Properties object, the `OldCfnRequestParams` Properties object, and the `reply` callback.

```
function Update(RequestPhysicalID, CfnRequestParams, OldCfnRequestParams, reply) {
  // code...
  if (err) {
    // Will fail the update.
    // err should be informative for Cfn template developer.
    return reply(err);
  }
  // Will pass the update.
  // physicalResourceId defaults to pre-update value.
  // FnGetAttrsDataObj is optional.
  reply(null, physicalResourceId, FnGetAttrsDataObj);
}
```

#### `Delete` Method Handler

Called when CloudFormation issues a `'DELETE'` command.  
Accepts the `RequestPhysicalId` `String`, `CfnRequestParams` Properties object, and the `reply` callback.

```
function Delete(RequestPhysicalID, CfnRequestParams, reply) {
  // code...
  if (err) {
    // Will fail the delete (or rollback).
    // USE CAUTION - failing aggressively will lock template,
    //   because DELETE is used during ROLLBACK phases.
    // err should be informative for Cfn template developer.
    return reply(err);
  }
  // Will pass the delete.
  // physicalResourceId defaults to pre-delete value.
  // FnGetAttrsDataObj is optional.
  reply(null, physicalResourceId, FnGetAttrsDataObj);
}
```

#### `Validate` Method Handler

Used before `'CREATE'`, `'UPDATE'`, or `'DELETE'` method handlers. The CloudFormation request will automatically fail if any truthy values are returned, and any `String` values returned are displayed to the template developer, to assist with resource `Properties` object correction.

*Important:* To prevent `ROLLBACK` lockage, the `'DELETE'` will be short circuited if this check fails. If this check fails, CloudFormation will be told that everything went fine, but no actual further actions will occur. This is because CloudFormation will immediately issue a `'DELETE'` after a failure in a `'CREATE'` or an `'UPDATE'`. Since these failures themselves will have resulted from a `Validate` method failure if the subsequent `'DELETE'` fails, this is safe.

```
function Validate(CfnRequestParams) {
  // code...
  if (unmetParamCondition) {
    return 'You must blah blah include a parameter... etc'
  }
  if (someOtherCondition) {
    return 'Informative message to CFN template developer goes here.'
  }
  // Returning a falsey value will allow the action to proceed.
  // DO NOT return truthy if the request params are valid.
}
```

#### `NoUpdate` Method Handler
  
In some cases, it is favorable to ignore `'UPDATE'` command requests issued by CloudFormation. You can define a `NoUpdate` function to cover this use case. By returning `true`, the `'UPDATE'` command request will be ignored and trivially passed as `'SUCCESS'` in CloudFormation.

`NoUpdate` is optional. If `NoUpdate` is not specified, equality of the `OldCfnRequestParams` and `CfnRequestParams` is tested using a simple `JSON.stringify` of both objects and string equality check. Since object properties may not be `JSON.stringified` in the same order, this is not a reliable fallback for users who intend to leverage this kind of check. The default is meant only as a low-pass filter.

``` 
function NoUpdate(CfnRequestParams, OldCfnRequestParams) {
  // code...
  if (paramsDontChangeAndWantToNoop) {
    // CloudFormation issued 'SUCCESS', but no real action is taken.
    // Update method handler is skipped.
    return true;
  } else {
    return false; // Update will proceed
  }
}
```


