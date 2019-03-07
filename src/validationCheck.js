
var path = require('path');
var fs = require('fs');

var Validator = require('jsonschema').Validator;
var JSONSchema = new Validator();

var metaschema = require('../lib/metaschema.json');


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
    if (JSONSchema.validate(schema, metaschema).errors.length) {
      return 'The custom resource\'s schema was an ' +
        'object, but was not valid JSONSchema v4.';
    } else {
      const errs = JSONSchema.validate(params, schema).errors.map(function(err) {
        // Guaranteed-order serialization w/ Array, hence weird format
        return [
          ['property ==>', err.property],
          ['message ==>', err.message],
          ['schema ==>', err.schema],
          ['instance ==>', err.instance],
          ['name ==>', err.name],
          ['argument ==>', err.argument],
          ['stack ==>', err.stack]
        ]
      });
      return errs.length && JSON.stringify(errs)
    }
  } else {
    return 'FATAL: Any Lambda Schema should be a plain Object.';
  }
}
