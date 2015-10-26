
var EqualNotificationParams = require('../helpers/equalNotificationParams');

module.exports = function NoUpdate(a, b) {
  return a.Bucket === b.Bucket && EqualNotificationParams(a, b);
};
