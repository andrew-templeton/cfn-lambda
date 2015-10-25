
var AWS = require('aws-sdk');
var S3 = new AWS.S3({apiVersion: '2006-03-01'});

var ExistingNotifications = require('../helpers/existingNotifications');

module.exports = function Create(Parameters, reply) {
  var Bucket = Parameters.Bucket;
  var NotifConfig = {
    Events: Parameters.Events,
    QueueArn: Parameters.QueueArn
  };
  ExistingNotifications(Bucket, function(err, data) {
    if (err) {
      return reply('CREATE was unable to access configs for the provided bucket.');
    }
    data.QueueConfigurations.push(NotifConfig);
    S3.putBucketNotificationConfiguration({
      Bucket: Bucket,
      NotificationConfiguration: data
    }, function(err, data) {
      if (err) {
        return reply('CREATE was unable to apply notification config to bucket.');
      }
      reply();
    });
  });
};
