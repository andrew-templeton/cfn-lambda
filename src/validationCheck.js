
var path = require('path');
var fs = require('fs');

var JaySchema = require('jayschema');
var JSONSchema = new JaySchema();

var metaschema = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  '..', 'lib', 'metaschema.json')).toString());


module.exports = function checkIfInvalid(params, validatorObject) {
  var loadedSchema;
  var invalidations = [];
  if (validatorObject.Validate !== undefined) {
    if ('function' === typeof validatorObject.Validate) {
      invalidations.push(validatorObject.Validate(params));
    } else {
      invalidations.push('FATAL: Any Lambda Validate should be a function.');
    }
  }
  if (validatorObject.Schema !== undefined) {
    invalidations.push(jsonSchemaValidator(params, validatorObject.Schema));
  }
  if (validatorObject.SchemaPath !== undefined) {
    if (Array.isArray(validatorObject.SchemaPath) &&
      validatorObject.SchemaPath.every(function(pathElement) {
        return 'string' === typeof pathElement;
    })) {
      try {
        loadedSchema = JSON.parse(fs.readFileSync(path
          .resolve.apply(path, validatorObject.SchemaPath)).toString());
      } catch (err) {
        invalidations.push('FATAL: No JSON was found at SchemaPath');
      }
      if (loadedSchema) {
        invalidations.push(jsonSchemaValidator(params, loadedSchema));
      }
    } else {
      invalidations.push('FATAL: Any Lambda SchemaPath should be an Array of String.');
    }
    
  }
  return invalidations.filter(function(invalidation) {
    return !!invalidation;
  }).join('\n');
};

function jsonSchemaValidator(params, schema) {
  if (Object.prototype.toString.call(schema) === '[object Object]') {
    if (JSONSchema.validate(schema, metaschema).length) {
      return 'The custom resource\'s schema was an ' +
        'object, but was not valid JSONSchema v4.';
    } else {
      return JSONSchema.validate(params, schema).map(function(err) {
        return new TypeError('At path: ' +
          err.instanceContext + ', had an error (' +
          err.constraintName + '), expected ' +
          err.constraintValue + ' but got ' + err.testedValue + '.');
      }).join('\n');
    }
  } else {
    return 'FATAL: Any Lambda Schema should be a plain Object.';
  }
}

