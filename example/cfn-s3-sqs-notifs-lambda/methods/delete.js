
var AWS = require('aws-sdk');
var S3 = new AWS.S3({apiVersion: '2006-03-01'});

var ExistingNotifications = require('../helpers/existingNotifications');

module.exports = function Delete(PhysicalId, Parameters, reply) {
  var Bucket = Parameters.Bucket;
  var NotifConfig = {
    Events: Parameters.Events,
    QueueArn: Parameters.QueueArn
  };
  ExistingNotifications(Bucket, function(err, data) {
    if (err && err.statusCode === 404) {
      // Bucket no longer there, implicitly deleted...
      return reply();
    }
    if (err) {
      return reply('DELETE was unable to get context for existing bucket.');
    }
    var existingStatementIndex = findNotifIndex(
      data.QueueConfigurations, NotifConfig);
    if (existingStatementIndex !== -1) {
      data.QueueConfigurations.splice(existingStatementIndex, 1);
    }
    S3.putBucketNotificationConfiguration({
      Bucket: Bucket,
      NotificationConfiguration: data
    }, function(err, data) {
      if (err) {
        return reply('DELETE was unable to push flushed bucket config.');
      }
      reply();
    });
  });
};
