
var AWS = require('aws-sdk');
var S3 = new AWS.S3({apiVersion: '2006-03-01'});

module.exports = function existingNotifications(bucket, callback) {
  S3.getBucketNotificationConfiguration({
    Bucket: bucket 
  }, function(err, data) {
    if (err) {
      console.log('Failed to access bucket notification configs!');
      return callback(err, null);
    }
    callback(null, data);
  });
}
