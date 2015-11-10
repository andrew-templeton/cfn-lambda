
var path = require('path');
var fs = require('fs');

var JaySchema = require('jayschema');
var Schema = new JaySchema();

var metaschema = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  '..', 'lib', 'metaschema.json')).toString());


module.exports = function checkIfValid(params, validator) {
  if (!validator) {
    return false;
  }
  if (Object.prototype.toString.call(validator) === '[object Object]') {
    if (Schema.validate(validator, metaschema).length) {
      return 'The custom resource\'s Validate property was an ' +
        'object, but was not a valid JSONSchema v4 object.';
    } else {
      return Schema.validate(params, validator).map(function(err) {
        return new TypeError('At path: ' +
          err.instanceContext + ', had an error (' +
          err.constraintName + '), expected ' +
          err.constraintValue + ' but got ' + err.testedValue + '.');
      }).join('\n') || false;
    }
  }
  if ('function' === typeof validator) {
    return validator(params) || false;
  }
  return 'The custom resource Validate property was defined, ' +
    'but was neither an Object for JSONSchema validation nor a function.';
};
