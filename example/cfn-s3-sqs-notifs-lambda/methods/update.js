
var AWS = require('aws-sdk');
var S3 = new AWS.S3({apiVersion: '2006-03-01'});

var ExistingNotifications = require('../helpers/existingNotifications');
var EqualNotificationParams = require('../helpers/equalNotificationParams');

module.exports = function Update(PhysicalId, Parameters, OldParameters, reply) {
  var Bucket = Parameters.Bucket;
  var OldBucket = OldParameters.Bucket;
  var NotifConfig = {
    Events: Parameters.Events,
    QueueArn: Parameters.QueueArn
  };
  var OldNotifConfig = {
    Events: OldParameters.Events,
    QueueArn: OldParameters.QueueArn
  }
  if (OldBucket === Bucket) {
    return ExistingNotifications(Bucket, function(err, data) {
      // Ignore bucket removal as implicit deletion
      if (err && err.statusCode !== 404) {
        return reply('UPDATE of type SAME BUCKET failed to access existing configs on original bucket.');
      }
      var existingStatementIndex = findNotificationIndex(
        data.QueueConfigurations, OldNotifConfig);
      if (existingStatementIndex === -1) {
        console.log('(WARN) WAS UNABLE TO FIND THE STATEMENT ON ORIGINAL BUCKET');
        data.QueueConfigurations.push(NotifConfig);
      } else {
        data.QueueConfigurations.splice(existingStatementIndex, 1, NotifConfig);
      }
      S3.putBucketNotificationConfiguration({
        Bucket: Bucket,
        NotificationConfiguration: data
      }, function(err, data) {
        if (err) {
          return reply('UPDATE of type SAME BUCKET failed to apply new configs to original bucket.');
        }
        reply();
      });
    });
  }
  ExistingNotifications(Bucket, function(err, data) {
    if (err) {
      return reply('UPDATE of type BUCKET SWAP failed to access existing configs on new bucket.');
    }
    var existingStatementIndex = findNotificationIndex(
      data.QueueConfigurations, NotifConfig);
    if (existingStatementIndex === -1) {
      // Normal case
      data.QueueConfigurations.push(NotifConfig);
    } else {
      // Some nasty ROLLBACK cases
      data.QueueConfigurations.splice(existingStatementIndex, 1, NotifConfig);
    }
    S3.putBucketNotificationConfiguration({
      Bucket: Bucket,
      NotificationConfiguration: data
    }, function(err, data) {
      if (err) {
        return reply('UPDATE of type BUCKET SWAP failed to apply notification to new bucket ' +
          '- does the queue allow publication from this bucket?');
      }
      ExistingNotifications(OldBucket, function(err, data) {
        if (err) {
          return reply('UPDATE of type BUCKET SWAP failed to access configs on old bucket.');
        }
        var existingStatementIndex = findNotificationIndex(
          data.QueueConfigurations, OldNotifConfig);
        if (existingStatementIndex !== -1) {
          data.QueueConfigurations.splice(existingStatementIndex, 1);
        }
        S3.putBucketNotificationConfiguration({
          Bucket: OldBucket,
          NotificationConfiguration: data
        }, function(err, data) {
          if (err) {
            return reply('UPDATE of type BUCKET SWAP failed to remove notification from old bucket.');
          }
          reply();
        });
      });
    });
  });
};

function findNotificationIndex(set, notif) {
  for (var index = 0; index < set.length; index++) {
    if (EqualNotificationParams(set[index], notif)) {
      return index;
    }
  }
  return -1;
}
