
var path = require('path')
var fs = require('fs')

const Composite = ({ AWS, Composition, PingInSeconds, MaxPings,  }) => {
  const CfnLambda = this
  const CFN = new AWS.CloudFormation()
  const RunComposition = Composition
  const TimeoutInMinutes = Math.ceil(PingInSeconds * MaxPings / 60) + 1
  const NoUpdate = (physicalId, params, reply) => {
    console.log('Entering NoUpdate for the composite resource, ' +
      'checking substack representation outputs for: %s', physicalId)
    CFN.describeStacks({
      StackName: physicalId
    }, function(getStackErr, stackData) {
      if (getStackErr) {
        console.error('During composite resource NoUpdate op on %s, ' +
          'unable to pull context Outputs: %j', physicalId, getStackErr)
        return reply('FATAL: could not pull context: ' +
          (err.message || 'TOTAL_FAILURE'))
      }
      if (!stackData.Stacks.length) {
        console.error('During composite resource NoUpdate op on %s, ' +
          'unable to pull context Outputs: (Not Found!)', physicalId)
        return reply('Could not find the composite resource stack.')
      }
      var outputHashFormatted = toGetAttFormat(stackData.Stacks[0].Outputs)
      console.log('Successfully acquired composite resource ' +
        'substack %s output hash: %j', physicalId, outputHashFormatted)
      reply(null, physicalId, outputHashFormatted)
    })
  }
  const Create = (params, reply) => {
    var ComposeInstance = new Composer()
    console.log('Entering composite resource CREATE action...')
    console.log('Running composite resource substack ' +
      'composition function with params: %j', params)
    RunComposition(params, ComposeInstance, function(composeErr) {
      if (composeErr) {
        console.error('Error while composing composite resource' +
          'substack representation for CREATE: %j', composeErr)
        return reply('FATAL substack composition error: ' +
          (composeErr.message || 'UNKNOWN_FATAL'))
      }
      var stackParams = {
        StackName: CfnLambda.Environment.LambdaName + Date.now(),
        Capabilities: [
          'CAPABILITY_IAM'
        ],
        OnFailure: 'DELETE',
        TemplateBody: ComposeInstance.Result(),
        TimeoutInMinutes: TimeoutInMinutes
      }
      console.log('Triggering substack representation launch of the ' +
        'resource with: %j', stackParams)
      CFN.createStack(stackParams, function(createInitErr, createInitData) {
        if (createInitErr) {
          console.error('Was unable to initialize creation of composite resource ' +
            'substack representation: %j', createInitErr)
          return reply('Composite substack create init error:' + (createInitErr.message || 'UNKNOWN_FATAL'))
        }
        console.log('Successfully initialized create of substack representation ' +
          'of the composite resource: %j', createInitData)
        reply(null, createInitData.StackId, {})
      })
    })
  }
  function Update(physicalId, params, oldParams, reply) {
    var ComposeInstance = new Composer()
    console.log('Entering composite resource UPDATE action...')
    console.log('Running composite resource substack ' +
      'composition function with params: %j', params)
    RunComposition(params, ComposeInstance, function(composeErr) {
      if (composeErr) {
        console.error('Error while composing composite resource' +
          'substack representation for UPDATE on %s: %j', physicalId, composeErr)
        return reply('FATAL substack composition error: ' +
          (composeErr.message || 'UNKNOWN_FATAL'))
      }
      var stackParams = {
        StackName: physicalId,
        Capabilities: [
          'CAPABILITY_IAM'
        ],
        TemplateBody: ComposeInstance.Result(),
        UsePreviousTemplate: false
      }
      console.log('Updating substack representation of ' +
        'resource %s with: %j', physicalId, stackParams)
      CFN.updateStack(stackParams, function(updateInitErr, updateInitData) {
        if (updateInitErr) {
          console.error('Was unable to initialize update of composite resource ' +
            'substack representation: %j', updateInitErr)
          return reply('Composite substack update init error:' + (updateInitErr.message || 'UNKNOWN_FATAL'))
        }
        console.log('Successfully initialized update of substack representation ' +
          'of the composite resource: %j', updateInitData)
        reply(null, updateInitData.StackId, {})
      })
    })
  }
  function Delete(physicalId, params, reply) {
    console.log('Entering composite resource DELETE action...')
    var stackParams = {
      StackName: physicalId
    }
    console.log('Deleting substack representation of ' +
      'resource %s with: %j', physicalId, stackParams)
    CFN.deleteStack(stackParams, function(deleteInitErr, deleteInitData) {
      if (deleteInitErr && deleteInitErr.statusCode !== 404) {
        console.error('Was unable to initialize delete of composite resource ' +
          'substack representation: %j', deleteInitErr)
        return reply('Composite substack delete init error:' + (deleteInitErr.message || 'UNKNOWN_FATAL'))
      }
      console.log('Successfully initialized delete of substack representation ' +
        'of the composite resource: %j', deleteInitData)
      reply(null, physicalId, {})
    })
  }
  function CheckCreate(createRes, params, reply, notDone) {
    var physicalId = createRes.PhysicalResourceId
    console.log('Entering CheckCreate for the composite resource, ' +
      'checking substack representation outputs for: %s', physicalId)
    CFN.describeStacks({
      StackName: physicalId
    }, function(getStackErr, stackData) {
      if (getStackErr) {
        console.error('During composite resource CheckCreate op on %s, ' +
          'unable to pull context Outputs: %j', physicalId, getStackErr)
        return reply('FATAL: could not pull context: ' +
          (getStackErr.message || 'TOTAL_FAILURE'))
      }
      if (!stackData.Stacks.length) {
        console.error('During composite resource CheckCreate op on %s, ' +
          'unable to pull context Outputs: (Not Found!)', physicalId)
        return reply('Could not find the composite resource stack.')
      }
      var Stack = stackData.Stacks[0]
      var StackStatus = Stack.StackStatus
      switch (StackStatus) {
        case 'CREATE_IN_PROGRESS':
          return notDone()
        case 'CREATE_FAILED':
        case 'CREATE_COMPLETE':
          return succeed()
        case 'ROLLBACK_IN_PROGRESS':
        case 'ROLLBACK_FAILED':
        case 'ROLLBACK_COMPLETE':
        case 'DELETE_IN_PROGRESS':
        case 'DELETE_FAILED':
        case 'DELETE_COMPLETE':
        case 'UPDATE_IN_PROGRESS':
        case 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS':
        case 'UPDATE_COMPLETE':
        case 'UPDATE_ROLLBACK_IN_PROGRESS':
        case 'UPDATE_ROLLBACK_FAILED':
        case 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS':
        case 'UPDATE_ROLLBACK_COMPLETE':
          return failure()
      }
      function failure() {
        console.error('Composite resource substack %s found ' +
          'to be broken during CheckCreate: %j', Stack)
        reply('Composite resource substack broken, in STATE => ' + StackStatus)
      }
      function succeed() {
        var outputHashFormatted = toGetAttFormat(Stack.Outputs)
        console.log('Successfully acquired composite resource ' +
          'substack %s output hash during CheckCreate: %j', physicalId, outputHashFormatted)
        reply(null, physicalId, outputHashFormatted)
      }
    })
  }
  function CheckUpdate(updateRes, physicalId, params, oldParams, reply, notDone) {
    console.log('Entering CheckUpdate for the composite resource, ' +
      'checking substack representation outputs for: %s', physicalId)
    CFN.describeStacks({
      StackName: physicalId
    }, function(getStackErr, stackData) {
      if (getStackErr) {
        console.error('During composite resource CheckCreate op on %s, ' +
          'unable to pull context Outputs: %j', physicalId, getStackErr)
        return reply('FATAL: could not pull context: ' +
          (getStackErr.message || 'TOTAL_FAILURE'))
      }
      if (!stackData.Stacks.length) {
        console.error('During composite resource CheckCreate op on %s, ' +
          'unable to pull context Outputs: (Not Found!)', physicalId)
        return reply('Could not find the composite resource stack.')
      }
      var Stack = stackData.Stacks[0]
      var StackStatus = Stack.StackStatus
      switch (StackStatus) {
        case 'CREATE_IN_PROGRESS':
        case 'CREATE_FAILED':
          return failure()
        case 'CREATE_COMPLETE':
        case 'ROLLBACK_IN_PROGRESS':
          return notDone()
        case 'ROLLBACK_FAILED':
        case 'ROLLBACK_COMPLETE':
          return failure()
        case 'DELETE_IN_PROGRESS':
          return notDone()
        case 'DELETE_FAILED':
        case 'DELETE_COMPLETE':
          return failure()
        case 'UPDATE_IN_PROGRESS':
        case 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS':
          return notDone()
        case 'UPDATE_COMPLETE':
          return succeed()
        case 'UPDATE_ROLLBACK_IN_PROGRESS':
          return notDone()
        case 'UPDATE_ROLLBACK_FAILED':
          return failure()
        case 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS':
          return notDone()
        case 'UPDATE_ROLLBACK_COMPLETE':
          return failure()
      }
      function failure() {
        console.error('Composite resource substack %s found ' +
          'to be broken during CheckUpdate: %j', Stack)
        reply('Composite resource substack broken, in STATE => ' + StackStatus)
      }
      function succeed() {
        var outputHashFormatted = toGetAttFormat(Stack.Outputs)
        console.log('Successfully acquired composite resource ' +
          'substack %s output hash during CheckUpdate: %j', physicalId, outputHashFormatted)
        reply(null, physicalId, outputHashFormatted)
      }
    })
  }
  function CheckDelete(deleteRes, physicalId, params, reply, notDone) {
    console.log('Entering CheckDelete for the composite resource, ' +
      'checking substack representation outputs for: %s', physicalId)
    CFN.describeStacks({
      StackName: physicalId
    }, function(getStackErr, stackData) {
      if (getStackErr && (
        getStackErr.statusCode === 404 ||
          getStackErr.message === 'Stack with id ' + physicalId + ' does not exist')) {
            console.log('During composite resource CheckDelete op on %s, ' +
              'unable to find Stack, implicit delete, succeeding: %j',
              physicalId, getStackErr)
            return reply(null, physicalId)
          }
      if (getStackErr) {
        console.error('During composite resource CheckDelete op on %s, ' +
          'unable to pull context: %j', physicalId, getStackErr)
        return reply('FATAL: could not pull context: ' +
          (getStackErr.message || 'TOTAL_FAILURE'))
      }
      if (!stackData.Stacks.length) {
        console.error('During composite resource CheckDelete op on %s, ' +
          'unable to pull context Outputs: (Not Found!)', physicalId)
        return reply('Could not find the composite resource stack.')
      }
      var Stack = stackData.Stacks[0]
      var StackStatus = Stack.StackStatus
      switch (StackStatus) {
        case 'CREATE_IN_PROGRESS':
          return notDone()
        case 'CREATE_FAILED':
        case 'CREATE_COMPLETE':
          return failure()
        case 'ROLLBACK_IN_PROGRESS':
          return notDone()
        case 'ROLLBACK_FAILED':
          return failure()
        case 'ROLLBACK_COMPLETE':
          return succeed()
        case 'DELETE_IN_PROGRESS':
          return notDone()
        case 'DELETE_FAILED':
          return failure()
        case 'DELETE_COMPLETE':
          return succeed()
        case 'UPDATE_IN_PROGRESS':
        case 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS':
          return notDone()
        case 'UPDATE_COMPLETE':
          return failure()
        case 'UPDATE_ROLLBACK_IN_PROGRESS':
          return notDone()
        case 'UPDATE_ROLLBACK_FAILED':
        case 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS':
          return notDone()
        case 'UPDATE_ROLLBACK_COMPLETE':
          return failure()
      }
      function failure() {
        console.error('Composite resource substack %s found ' +
          'to be broken during CheckDelete: %j', Stack)
        reply('Composite resource substack broken, in STATE => ' + StackStatus)
      }
      function succeed() {
        console.log('Successfully found destroyed ' +
          'substack %s during CheckDelete.', physicalId)
        reply(null, physicalId)
      }
    })
  }
  function serviceToken(mod) {
    return [
      "arn",
      "aws",
      "lambda",
      CfnLambda.Environment.Region,
      CfnLambda.Environment.AccountId,
      "function",
      (mod.Name + '-' + mod.Version.replace(/\./g, '-'))
    ].join(':')
  }
  function Composer() {
    var Template = {
      AWSTemplateFormatVersion: "2010-09-09",
      Description: "A dynamic cfn-lambda Composite resource substack.",
      Resources: {},
      Outputs: {}
    }
    function AddResource(ns, logicalId, params, deps) {
      Template.Resources[logicalId] = 'string' === typeof ns
        ? makeResource(ns, params, deps)
        : customResource(ns, params, deps)
    }
    function AddOutput(logicalName, value) {
      Template.Outputs[logicalName] = {
        Description: 'Composite resource substack output for: ' + logicalName,
        Value: value
      }
    }
    function Result() {
      return JSON.stringify(Template)
    }
    return {
      AddResource: AddResource,
      AddOutput: AddOutput,
      Result: Result
    }
  }

  function customResource(mod, params, deps) {
    var Properties = clone(params)
    var ResourceType = 'Custom::' + mod.Name.split('-').map(function(piece) {
      return piece[0].toUpperCase() + piece.slice(1, piece.length)
    }).join('')
    Properties.ServiceToken = serviceToken(mod)
    return makeResource(ResourceType, Properties, deps)
  }

  function makeResource(type, params, deps) {
    var resource = {
      Type: type,
      Properties: params
    }
    if (Array.isArray(deps) && deps.length) {
      resource.DependsOn = deps
    }
    return resource
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  function toGetAttFormat(outputs) {
    return (outputs || []).reduce(function(hash, output) {
      hash[output.OutputKey] = output.OutputValue
      return hash
    }, {})
  }


  return CfnLambda({
    NoUpdate,
    Create,
    Update,
    Delete,
    LongRunning: {
      PingInSeconds,
      MaxPings,
      LambdaApi: new AWS.Lambda(),
      Methods: {
        Create: CheckCreate,
        Update: CheckUpdate,
        Delete: CheckDelete
      }
    }
  })
}

function Module(name) {
  var modulePackageContent = JSON.parse(fs
    .readFileSync(path.resolve(__dirname,
      '..', '..', name, 'package.json')).toString())
  return {
    Name: name,
    Version: modulePackageContent.version
  }
}



Composite.Module = Module

module.exports = Composite
