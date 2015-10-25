
# cfn-lambda


## Purpose

A framework for building custom AWS resources. 


## Usage

```
var CfnLambda = require('cfn-lambda');

exports.handler = CfnLambda({
  Create: function(CfnRequestParams, reply) {
    // code...
    if (err) {
      // Will fail the create.
      // err should be informative for Cfn template developer.
      return reply(err);
    }
    // Will pass the create.
    // *** physicalResourceId is REQUIRED String and cannot be empty! ***
    // FnGetAttrsDataObj is optional.
    reply(null, physicalResourceId, FnGetAttrsDataObj);
  },
  Update: function(CfnRequestParams, OldCfnRequestParams, reply) {
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
  },
  Delete: function(CfnRequestParams, reply) {
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
  },
  Validate: function(CfnRequestParams) {
    // code...
    if (unmetParamCondition) {
      return 'You must blah blah include a parameter... etc'
    }
    if (someOtherCondition) {
      return 'Informative message to CFN template developer goes here.'
    }
    // Returning a falsey value will allow the action to proceed.
    // DO NOT return truthy if the request params are valid.
  },
  NoUpdate: function(CfnRequestParams, OldCfnRequestParams) {
    // code...
    if (paramsDontChangeAndWantToNoop) {
      return true;
    } else {
      return false; // Update will proceed
    }
  }
});
```


