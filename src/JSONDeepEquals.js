var _ = require('underscore');

module.exports = function JSONDeepEquals(a, b) {
  return _.isEqual(a, b);
};
