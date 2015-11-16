
# cfn-lambda


## Purpose

A simple flow for generating CloudFormation Lambda-Backed Custom Resource handlers in node.js. The scope of this module is to structure the way developers author simple Lambda-Backed resources into simple functional definitions of `Create`, `Update`, `Delete`, validation of resource `'Properties'`, and `NoUpdate` (noop detection on `Update`). Also provides convenience `Environment` values, and an `SDKAlias` function generator that structures and greatly simplifies the development of custom resources that are supported by the Node.js `aws-sdk` but not supported by CloudFormation.


## Examples

 - [Custom::ApiGatewayRestApi](https://gitub.com/andrew-templeton/cfn-api-gateway-restapi)
 - [Custom::ApiGatewayDeployment](https://gitub.com/andrew-templeton/cfn-api-gateway-deployment)
 - [Custom::ApiGatewayStage](https://gitub.com/andrew-templeton/cfn-api-gateway-stage)

## Deployment of Lambdas

Any custom resource using this tool as a dependency can run this deploy script from the root of the custom resource project to deploy Lambdas to all regions. Add this line to the `"scripts"` section of your `package.json` inside your repository using this module as a direct dependency:

    "cfn-deploy": "chmod +x ./node_modules/cfn-lambda/deploy.sh && ./node_modules/cfn-lambda/deploy.sh;"

You must also set up:

1. Add `<reporoot>/execution-policy.json` to define the abilities the Lambda should have.
2. Have AWS credentials configured in your environment, via one of:
  + `$AWS_PROFILE` in your environment
  + a credentials file
  + `$AWS_ACCESS_KEY_ID` and `$AWS_SECRET_ACCESS_KEY` in your environment.


You then run this from within the repository directly depending on `cfn-lambda`:

    $ npm run cfn-lambda-deploy


It should look like this: 


![Insta-Deploy](./ex-deploy-term.png)




## Usage

This is a contrived example call to fully demonstrate the way to interface with the creation API.

You can manually define these properties, or use `SDKAlias` for `Create`, `Update` and/or `Delete`. 


### Resource Lambda Generation
```
var CfnLambda = require('cfn-lambda');


exports.handler = CfnLambda({

  Create: Create, // Required function
  Update: Update, // Required function
  Delete: Delete, // Required function

  // Any of following to validate resource Properties
  // If you do not include any, the Lambda assumes any Properties are valid.
  // If you define more than one, the system uses all of them in this order.
  Validate: Validate,     // Function
  Schema: Schema,         // JSONSchema v4 Object
  SchemaPath: SchemaPath, // Array path to JSONSchema v4 JSON file
  // end list

  NoUpdate: NoUpdate // Optional

});
```

### `Environment` Convenience Property

Provides convenience `Environment` values.: 

    var CfnLambda = require('cfn-lambda');
    // After receiving `event` and `context`...
    console.log(CfnLambda.Environment);
    /*
    {
      `LambdaArn`: 'foo bar',      // Full ARN for the current Lambda
      `Region`: 'us-east-1',       // Region in which current Lambda resides
      `AccountId`: '012345678910', // The account associated with the Lambda
      `LambdaName`: 'LambdaName'   // Name for the current Lambda
    }
    */


Only works after the generated `CfnLambda` function has been called by Lambda.


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

### Validating Properties

Used before `'CREATE'`, `'UPDATE'`, or `'DELETE'` method handlers. The CloudFormation request will automatically fail if any truthy values are returned, and any `String` values returned are displayed to the template developer, to assist with resource `Properties` object correction.

*Important:* To prevent `ROLLBACK` lockage, the `'DELETE'` will be short circuited if this check fails. If this check fails, CloudFormation will be told that everything went fine, but no actual further actions will occur. This is because CloudFormation will immediately issue a `'DELETE'` after a failure in a `'CREATE'` or an `'UPDATE'`. Since these failures themselves will have resulted from a validation method failure if the subsequent `'DELETE'` fails, this is safe.

May be a:
 - Custom validation function as `Validate` callback
 - JSONSchema v4 `Schema`
 - JSONSchema v4 file path as `SchemaPath`

#### `Validate` Method Handler

The truthy `String` return value will cause a `'FAILURE'`, and the `String` value is used as the CloudFormation `'REASON'`.

```
// Example using a custom function
// CfnRequestParams are all resource `Properties`,
//   except for the required system `ServiceToken`.
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

#### `Schema` Object - JSONSchema Version 4

Using a JSONSchema `Schema` property value will automatically generate the `String` invalidation return values for you when validating against the parameters - simply provide the template and the validation and error messging is taken care of for you.

If you choose to use a JSONSchema template, the service will also use the JSONSchema metaschema to ensure the provided JSONSchema is a valid schema itself.

```
// Example using a custom JSONSchema Version 4 template
// This might be in a file you manually load like `schema.json`, or a JS object.
var Schema = {
  type: 'object',
  required: [
    'foo'
  ],
  properties: {
    foo: {
      type: 'string'
    },
    selectable: {
      type: 'string',
      enum: ['list', 'of', 'valid', 'values']
    }
  },
  additionalProperties: false
};
```

#### `SchemaPath` Array - Path to JSONSchema Version 4 File

A convenient way to get the benefits of `Schema` object validation, but keeping your code clean and segregated nicely.

The path is defined as an Array so that we can use the `path` module.

```
var SchemaPath = [__dirname, 'src', 'mytemplate.json'];
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

## `SDKAlias` Function Generator

Structures and accelerates development of resources supported by the `aws-sdk` (or your custom SDK) by offering declarative tools to ingest events and proxy them to AWS services.

Will automatically correctly ignore `ServiceToken` from CloudFormation Properties. All settings are optional, except `api` and `method`.

##### Usage Reference
```
var AWS = require('aws-sdk');
var AnAWSApi = new AWS.SomeNamespace();
var CfnLambda = require('cfn-lambda');
// Then used as the Create property as defined in Usage above
var MyAliasActionName = CfnLambda.SDKAlias({ // Like Create, Update, Delete
  returnPhysicalId: 'KeyFromSDKReturn' || function(data) { return 'customValue'; }, 
  downcase: boolean, // Downcase first letter of all top-level params from CloudFormation
  api: AnAWSApi, // REQUIRED
  method: 'methodNameInSDK', // REQUIRED
  mapKeys: {
    KeyNameInCfn: 'KeyNameForSDK'
  },
  keys: [ // Defaults to including ALL keys from CloudFormation, minus ServiceToken
    'KeysFrom',
    'CloudFormationProperties',
    'ToPassTo',
    'TheSDKMethod',
    '**UsedBeforeMapKeys**'
  ],
  returnKeys: [
    'KeysFrom',
    'SDKReturnValue',
    'ToUseWithCfn',
    'Fn::GetAttr'
  ],
  ignoreErrorCodes: [IntegerCodeToIgnore, ExWouldBe404ForDeleteOps],
  physicalIdAs: 'UsePhysicalIdAsThisKeyInSDKCall', 
});

// Then...

exports.handler = CfnLambda({
  Create: MyAliasActionName, // Doesn't have to be Create, can be Update or Delete
  // ...
});
```

