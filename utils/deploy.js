var main = function(options, main_callback){
  // main code
	if (!options) {
		main_callback = options;
		options = {};
	}

	var format = require('string-format');
	var path = require('path');
	var fs = require('fs');
	var stream = require('stream');
	var async = require('async');
	var archiver = require('archiver');

	var DEFAULT_REGION = options.defaultRegion || 'us-east-1';
	var REGIONS =  options.deployRegions || ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'];

	var RESOURCE_DIR = options.cfnModule ? path.join(process.cwd(), 'node_modules', options.cfnModule) : process.cwd();
	var CFN_LAMBDA_DIR = path.join(__dirname, '../lib');

	var RESOURCE_INFO = require(path.join(RESOURCE_DIR, 'package.json'));
	var FULL_NAME = format("{}-{}", RESOURCE_INFO.name, RESOURCE_INFO.version.replace(/\./g, '-'));
	var LAMBDA_TIMEOUT = options.lambdaTimeout || 300;
	var LAMBDA_MEMORY_SIZE = options.lambdaMemorySize || 128;
	var POLICY = fs.readFileSync(path.join(RESOURCE_DIR, 'execution-policy.json')).toString();
	var TRUST = fs.readFileSync(path.join(CFN_LAMBDA_DIR, 'lambda.trust.json')).toString();
	var LAMBDA_DESC = format('CloudFormation Custom Resource service for Custom::{name}', RESOURCE_INFO);
	var ACCOUNT_RE = /arn:aws:.*::(.*?):.*/;


	var zip_parts = [];

	var archive = archiver('zip');

	var converter = new stream.Writable({
	  write: function (chunk, encoding, next) {
	    zip_parts.push(chunk);
	    next()
	}});

	converter.on('finish', start_deploy)

	console.log('Zipping Lambda bundle to buffer...');

	var options = {
		cwd: RESOURCE_DIR,
		ignore: ["deploy/**"]
	};
  try {
    var ignore = fs.readFileSync( path.join(RESOURCE_DIR, ".zipignore"), 'utf8' );
    options.ignore = _.compact( _.flatten([options.ignore, ignore.split('\n')]) );
  } catch (e) {}
  archive.glob(RESOURCE_DIR + '/**/*.*', options);

	archive.pipe(converter);

	archive.finalize();


	var AWS = require('aws-sdk');
	AWS.config.region = DEFAULT_REGION;

	var iam = new AWS.IAM();
	var sts = new AWS.STS({apiVersion: '2011-06-15'});
	var deploy_zip;
	var user_data;
	var role_arn;

	function start_deploy() { // Will be emitted when the input stream has ended, ie. no more data will be provided
	  console.log('~~~~ Deploying Lambda to all regions (' + REGIONS.join(' ') + '). ~~~~');
	  deploy_zip = Buffer.concat(zip_parts); // Create a buffer from all the received chunks
	  sts.getCallerIdentity({}, function (err, data) {
	    if (err) { throw err }
	    user_data = data;
	    handle_roles(err);
	  })
	}

	function handle_roles(err) {

	  role_arn = format('arn:aws:iam::{}:role/{}',
	    user_data.Arn.replace(ACCOUNT_RE, '$1'), FULL_NAME);

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
	              callback();
	            },
	            10000);
	        });
	      }],
	    handle_regions); // waterfall 1
	  }

	var handle_regions = function handle_regions() {
	  console.log('Beginning deploy of Lambdas to Regions: ' + REGIONS.join(' '));
	  async.each(REGIONS,
	    function (region, region_callback) {
	      handle_region(region, region_callback);
	    },
	    function () {
	      console.log('~~~~ All done! Lambdas are deployed globally and ready for use by CloudFormation. ~~~~');
	      console.log('~~~~                They are accessible to your CloudFormation at:                ~~~~');
	      console.log(format('aws:arn:<region>:{}:function:{}', user_data.Arn.replace(ACCOUNT_RE, '$1'), FULL_NAME));
	      if (main_callback) main_callback(
	      	format('aws:arn:{{}}:{}:function:{}',
	      		user_data.Arn.replace(ACCOUNT_RE, '$1'),
	      		FULL_NAME)
	      	);
	  });
	}

	function handle_region(region, region_callback) {

	  var RegionAWS = require('aws-sdk');
	  RegionAWS.config.region = region;

	  var lambda = new RegionAWS.Lambda();

	  console.log('Deploying Lambda to: ' + region);

	  async.waterfall([
	      function(callback) {
	          lambda.createFunction({
	            Code: {ZipFile: deploy_zip},
	            FunctionName: FULL_NAME,
	            Description: LAMBDA_DESC,
	            Role: role_arn,
	            Handler: 'index.handler',
	            Runtime: 'nodejs',
	            Timeout: LAMBDA_TIMEOUT,
	            MemorySize: LAMBDA_MEMORY_SIZE
	          },
	          function(err, data) {
	            if (err) {
	              if (err.code === 'ResourceConflictException') {
	                callback(null, false);
	              } else {
	                throw err;
	              }
	            } else {
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
	            Role: role_arn,
	            Handler: 'index.handler',
	            Timeout: LAMBDA_TIMEOUT,
	            MemorySize: LAMBDA_MEMORY_SIZE
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
	          lambda.updateFunctionCode({FunctionName: FULL_NAME, ZipFile: deploy_zip},
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
}

module.exports = main;
