
// This is usually:
//   require('cfn-lambda');
var CfnLambda = require('../index');

var resourceDefinition = {
  Create: require('./methods/create'),
  Update: require('./methods/update'),
  Delete: require('./methods/delete'),
  Validate: require('./methods/validate'),
  NoUpdate: require('./methods/noUpdate')
};

// Returns the complete lambda handler w/ functional currying
exports.handler = CfnLambda(resourceDefinition);
