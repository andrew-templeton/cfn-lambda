
var async = require('async'),
  format = require('string-format'),
  path = require('path'),
  fs = require('fs'),
  archiver = require('archiver'),
  stream = require('stream'),

  DEFAULT_REGION = 'us-east-1',
  REGIONS =  ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'],
  RESOURCE_DIR = path.join(__dirname, '..', '..')
  CFN_LAMBDA_DIR = path.join(__dirname, 'lib'),
  RESOURCE_INFO = require(path.join(RESOURCE_DIR, 'package.json')),
  FULL_NAME = format("{}-{}", RESOURCE_INFO.name, RESOURCE_INFO.version.replace(/\./g, '-')),
  POLICY = fs.readFileSync(path.join(RESOURCE_DIR, 'execution-policy.json')).toString(),
  TRUST = fs.readFileSync(path.join(CFN_LAMBDA_DIR, 'lambda.trust.json')).toString(),
  LAMBDA_DESC = format('CloudFormation Custom Resource service for Custom::{name}', RESOURCE_INFO)
  ACCOUNT_RE = /arn:aws:iam::(.*?):user.*/;


var zip_parts = []

var archive = archiver('zip');

var converter = new stream.Writable({
  write: function (chunk, encoding, next) {
    zip_parts.push(chunk);
    next()
}});

converter.on('finish', start_deploy)

console.log('Zipping Lambda bundle to buffer...');

archive.directory(RESOURCE_DIR, '');

archive.pipe(converter);

archive.finalize();


var AWS = require('aws-sdk');
AWS.config.region = DEFAULT_REGION;

var iam = new AWS.IAM();

function start_deploy() { // Will be emitted when the input stream has ended, ie. no more data will be provided
  console.log('~~~~ Deploying Lambda to all regions (' + REGIONS.join(' ') + '). ~~~~');
  var base64_zip = Buffer.concat(zip_parts); // Create a buffer from all the received chunks
  iam.getUser({}, function (err, user_data) {
    if (err) { throw err; }
    handle_roles(err, user_data, base64_zip);
  })
}

function handle_roles(err, user_data, base64_zip) {

  var ROLE_ARN = format('arn:aws:iam::{}:role/{}',
    user_data.User.Arn.replace(ACCOUNT_RE, '$1'), FULL_NAME);

  console.log(ROLE_ARN);

  async.waterfall([
      function(callback) {
        iam.createRole({AssumeRolePolicyDocument: TRUST, RoleName: FULL_NAME}, function(err, data) {
          if (err !== null) {
            console.log('Created Role!');
            callback(null, true);
          }
          else {
            callback(null, false);
          }
        });
      },
      function(skip, callback) {
        if (skip) {
          callback(null);
        }
        else {
          iam.updateAssumeRolePolicy({PolicyDocument: TRUST, RoleName: FULL_NAME}, function(err, data) {
            if (err) { throw err; }
            else { callback(null); }
          });
        }
      },
      function(callback) {
        iam.putRolePolicy({PolicyDocument: POLICY, PolicyName: FULL_NAME + '_policy', RoleName: FULL_NAME},
          function(err, data) {
            if (err) { throw err; }
            console.log('Added Policy!');
            console.log("Sleeping 5 seconds for policy to propagate.");
            setTimeout(function() {
              callback(user_data, base64_zip, ROLE_ARN);
            }, 
            10000);
        });
      }],
    handle_regions); // waterfall 1
  }

function handle_regions(user_data, base64_zip, ROLE_ARN) {
  console.log('Beginning deploy of Lambdas to Regions: ' + REGIONS.join(' '));
  async.each(REGIONS,
    function (region, region_callback) {
      handle_region(region, region_callback, base64_zip, ROLE_ARN);
    },
    function () {
      console.log('~~~~ All done! Lambdas are deployed globally and ready for use by CloudFormation. ~~~~');
      console.log('~~~~                They are accessible to your CloudFormation at:                ~~~~');
      console.log(format('aws:arn:<region>:{}:function:{}', user_data.User.Arn.replace(ACCOUNT_RE, '$1'), FULL_NAME));
  });
}

function handle_region(region, region_callback, base64_zip, ROLE_ARN) { 

  var RegionAWS = require('aws-sdk');
  RegionAWS.config.region = region;
  
  var lambda = new RegionAWS.Lambda();
  
  console.log('Deploying Lambda to: ' + region);

  async.waterfall([
      function(callback) {
          lambda.createFunction({
            Code: {ZipFile: base64_zip},
            FunctionName: FULL_NAME,
            Description: LAMBDA_DESC,
            Role: ROLE_ARN,
            Handler: 'index.handler',
            Runtime: 'nodejs',
            Timeout: 300,
            MemorySize: 128
          },
          function(err, data) {
            if (err !== null) {
              callback(null, false);
            }
            else {
              console.log(format('Created Function "{}" on {}!', FULL_NAME, region));
              callback(null, true);
            }
        });
      },
      function(skip, callback) {
        if (skip) {
          callback(null, true);
        }
        else {
          lambda.updateFunctionConfiguration({
            FunctionName: FULL_NAME,
            Description: LAMBDA_DESC,
            Role: ROLE_ARN,
            Handler: 'index.handler',
            Timeout: 300,
            MemorySize: 128
          },
          function(err, data) {
            if (err !== null) {
              throw err;
            }
            else {
              console.log(format('Updated Function Configuration for "{}" on {}!', FULL_NAME, region));
              callback(null, false);
            }
          });
        }          
      },
      function(skip, callback) {
        if (skip) {
          callback();
        }
        else {
          lambda.updateFunctionCode({FunctionName: FULL_NAME, ZipFile: base64_zip},
            function(err, data) {
              if (err !== null) {
                throw err;
              }
              else {
                console.log(format('Updated Function Code for "{}" on {}!', FULL_NAME, region));
                callback();
              }
          });
        }       
      }
    ],
    function () {
      console.log(format('Upserted lambda "{}" on {}!', FULL_NAME, region));
      region_callback();
    }
  );
}  