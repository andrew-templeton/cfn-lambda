const archiver = require('archiver')
const async = require('async')
const AWS = require('aws-sdk')
const nanoArgv = require('nano-argv')
const path = require('path')
const stream = require('stream')

const regions = require('./lib/lambda.regions.json')
const template = require('./lib/cfn-template.json')

const DEFAULT_RUNTIME = 'nodejs10.x'

const defaults = {
  account: null,
  alias: null,
  allregions: false,
  logs: false,
  module: null,
  path: null,
  public: false,
  quiet: false,
  regions: process.env.AWS_REGION || '',
  rollback: true,
  version: null,
  runtime: DEFAULT_RUNTIME
}

AWS.config.region = process.env.AWS_REGION || 'us-east-1'

module.exports = CfnResourceDeploy

if (require.main === module) {
  defaults.logs = true
  const opts = nanoArgv(defaults)
  opts.regions = opts.regions.split(',')
  CfnResourceDeploy(opts, (err, results) => {
    if (err) {
      console.error('')
    }
  })
}

function CfnResourceDeploy (options, deployDone) {
  options = options || {}

  const log = logger('log')
  const error = logger('error')
  const resourceTypeDir = options.path
    ? path.resolve(options.path)
    : options.module
      ? path.resolve(process.cwd(), 'node_modules', options.module)
      : path.resolve(__dirname, '..', '..')
  const resourceTypeInfo = require(path.resolve(resourceTypeDir, 'package.json'))
  const resourceTypeName = options.alias || resourceTypeInfo.name
  const resourceTypeVersion = options.version || resourceTypeInfo.version.replace(/\./g, '-')
  const policy = require(path.resolve(resourceTypeDir, 'execution-policy.json'))
  template.Resources.ServiceLambdaRolePolicy.Properties.PolicyDocument = policy
  template.Description = `Custom resource type installer stack for ${resourceTypeName}-${resourceTypeVersion}`

  log('Zipping code bundle...')
  zip(resourceTypeDir, (err, zippedCodeBuffer) => {
    if (err) {
      error('Fatal error: Could not zip: ')
      error(err)
      return deployDone(err)
    }
    log('Zip complete, acquiring account ID...')
    getAccountId((err, accountId) => {
      if (err) {
        error('Fatal error: Could not acquire account ID (set manually with --account): ')
        error(err)
        return deployDone(err)
      }
      log(`Account ID set to ${accountId}`)
      options.account = accountId
      log('Deploying region set: ')
      if (options.allregions) {
        options.regions = regions.map(region => {
          return region.identifier
        })
      }
      log(options.regions)
      async.each(options.regions, deployRegion, (err) => {
        if (err) {
          error('Problem deploying to the regions:')
          error(err)
          return deployDone(err)
        }
        log('Finished deploying to regions. Your custom resource is ready with ServiceToken:')
        log(`aws:arn:<region>:${options.account}:function:${resourceTypeName}-${resourceTypeVersion}`)
        deployDone()
      })
    })
    function deployRegion (region, regionDone) {
      // Make bucket
      // Upload function code
      // Upload cloudformation template
      // Upload launcher
      // Invoke CloudFormation
      // Wait for finish
      async.waterfall([
        upsertBucket,
        uploadLambdaFunctionCode,
        uploadCloudFormationTemplate,
        uploadLauncherPage,
        invokeCloudFormation,
        // waitOnCloudFormation
      ], function (err, result) {
        if (err) {
          error(`${region} - ERROR with deploy: `)
          error(err)
          return regionDone(err)
        }
        log(`${region} - Finished deploying region.`)
        regionDone()
      })
      function upsertBucket (bucketDone) {
        const RegionalAWS = require('aws-sdk')
        RegionalAWS.config.region = region
        const regionalS3 = new RegionalAWS.S3()
        const bucketName = getBucketName(region)
        log(`${region} - Upserting bucket ${bucketName}...`)
        regionalS3.createBucket({
          Bucket: bucketName,
        }, (err, data) => {
          if (err && err.code !='BucketAlreadyOwnedByYou') {
            error(`${region} - ERROR deploying regional bucket:`)
            error(err)
            return bucketDone(err)
          }
          log(`${region} - Upserted regional bucket: ${bucketName}`)
          if (!options.public) {
            log(`${region} - Completed deploying regional bucket: ${bucketName}`)
            return bucketDone()
          }
          log(`${region} - Updating bucket policy to public...`)
          regionalS3.putBucketPolicy({
            Bucket: bucketName,
            Policy: JSON.stringify({
              "Version":"2012-10-17",
              "Statement": [
                {
                  "Sid": "AddPerm",
                  "Effect": "Allow",
                  "Principal": "*",
                  "Action": [
                    "s3:GetObject"
                  ],
                  "Resource": [
                    `arn:aws:s3:::${bucketName}/*`
                  ]
                }
              ]
            })
          }, (err, data) => {
            if (err) {
              error(`ERROR setting bucket policy to public:`)
              error(err)
              return bucketDone(err)
            }
            log(`${region} - Completed putting public bucket policy on regional bucket: ${bucketName}`)
            log(`${region} - Completed deploying regional bucket: ${bucketName}`)
            bucketDone()
          })
        })
      }
      function uploadLambdaFunctionCode (codeUploadDone) {
        const RegionalAWS = require('aws-sdk')
        RegionalAWS.config.region = region
        const regionalS3 = new RegionalAWS.S3()
        log(`${region} - Uploading Lambda function code...`)
        regionalS3.putObject({
          Bucket: getBucketName(region),
          Key: `${resourceTypeVersion}.zip`,
          Body: zippedCodeBuffer
        }, (err, data) => {
          if (err) {
            error(`${region} - ERROR uploading Lambda code:`)
            error(err)
            return codeUploadDone(err)
          }
          log(`${region} - Lambda code uploaded.`)
          codeUploadDone()
        })
      }
      function uploadCloudFormationTemplate (cfnUploadDone) {
        const RegionalAWS = require('aws-sdk')
        RegionalAWS.config.region = region
        const regionalS3 = new RegionalAWS.S3()
        log(`${region} - Uploading CloudFormation template...`)
        regionalS3.putObject({
          Bucket: getBucketName(region),
          Key: `${resourceTypeVersion}.json`,
          Body: JSON.stringify(template)
        }, (err, data) => {
          if (err) {
            error(`${region} - PROBLEM uploading CloudFormation template:`)
            error(err)
            return cfnUploadDone(err)
          }
          log(`${region} - CloudFormation template uploaded.`)
          cfnUploadDone()
        })
      }
      function uploadLauncherPage (launcherUploadDone) {
        const RegionalAWS = require('aws-sdk')
        RegionalAWS.config.region = region
        const regionalS3 = new RegionalAWS.S3()
        log(`${region} - Uploading launcher page...`)
        regionalS3.putObject({
          Bucket: getBucketName(region),
          Key: `${resourceTypeVersion}.html`,
          Body: composeHtml(),
          ContentType: 'text/html'
        }, (err, data) => {
          if (err) {
            error(`${region} - PROBLEM uploading launcher page to region:`)
            error(err)
            return launcherUploadDone(err)
          }
          log(`${region} - Launcher page uploaded.`)
          launcherUploadDone()
        })
      }
      function invokeCloudFormation (invokeComplete) {
        const RegionalAWS = require('aws-sdk')
        RegionalAWS.config.region = region
        const regionalCloudFormation = new RegionalAWS.CloudFormation()
        log(`${region} - Creating CloudFormation stack...`)
        const cloudFormationParams = [
          {
            ParameterKey: 'ResourceTypeName',
            ParameterValue: resourceTypeName
          },
          {
            ParameterKey: 'ResourceTypeVersion',
            ParameterValue: resourceTypeVersion
          },
          {
            ParameterKey: 'CodeBucket',
            ParameterValue: getBucketName(region)
          },
          {
            ParameterKey: 'LambdaRuntimeVersion',
            ParameterValue: options.runtime || DEFAULT_RUNTIME
          }
        ]
        regionalCloudFormation.createStack({
          StackName: `${resourceTypeName}-${resourceTypeVersion}`,
          Capabilities: [
            'CAPABILITY_IAM'
          ],
          DisableRollback: options.rollback === 'false' || !options.rollback,
          Parameters: cloudFormationParams,
          TemplateBody: JSON.stringify(template)
        }, (err, data) => {
          if (err) {
            if (err.code !== 'AlreadyExistsException') {
              error(`${region} - PROBLEM creating stack: `)
              error(err)
              return invokeComplete(err)
            }
            log(`${region} - Stack already existed, will update...`)
            return regionalCloudFormation.updateStack({
              StackName: `${resourceTypeName}-${resourceTypeVersion}`,
              Capabilities: [
                'CAPABILITY_IAM'
              ],
              Parameters: cloudFormationParams,
              TemplateBody: JSON.stringify(template)
            }, (err, data) => {
              if (err && err.message !== 'No updates are to be performed.') {
                error(`${region} - PROBLEM updating stack: `)
                error(err)
                return invokeComplete(err)
              }
              log(`${region} - Stack updated.`)
              invokeComplete()
            })
          }
          log(`${region} - Stack created.`)
          invokeComplete()
        })
      }
    }
    function regionLauncherUrl(region) {
      const s3Host = region.identifier === 'us-east-1'
        ? 's3.amazonaws.com'
        : `s3-${region.identifier}.amazonaws.com`
      return `https://${region.identifier}.console.aws.amazon.com/cloudformation/home?region=${region.identifier}#/stacks/create/review?templateURL=https://${s3Host}/${getBucketName(region.identifier)}/${resourceTypeVersion}.json&stackName=${resourceTypeName}-${resourceTypeVersion}&param_ResourceTypeName=${resourceTypeName}&param_ResourceTypeVersion=${resourceTypeVersion}&param_CodeBucket=${getBucketName(region.identifier)}`
    }
    function composeHtml () {
      var attributions = ''
      if ('string' === typeof resourceTypeInfo.author) {
        attributions += `<p>By: ${resourceTypeInfo.author}</p>`
      }
      if (resourceTypeInfo.description) {
        attributions += `<p>${resourceTypeInfo.description}</p>`
      }
      if (resourceTypeInfo.homepage) {
        attributions += `<p>Homepage: <a href="${resourceTypeInfo.homepage}">${resourceTypeInfo.homepage}</a></p>`
      }
      if (resourceTypeInfo.license) {
        attributions += `<p>License: ${resourceTypeInfo.license}</p>`
      }

      return `<html><head><title>Deploy ${resourceTypeName} v${resourceTypeVersion}</title></head><body>` +
        '<h1>CloudFormation Custom Resource Installer</h1>' +
        `<h2>${resourceTypeName} v${resourceTypeVersion}</h2>` +
        attributions +
        '<h3>Regional Launchers</h3>' +
        `<ul>${regions.filter(isLive).map(regionLine).join('')}</ul>` +
        '</body></html>'
      function regionLine(region) {
        return `<li>${region.identifier} / ${region.name} : <a href="${regionLauncherUrl(region)}">Launch</a></li>`
      }
      function isLive (region) {
        return !!~options.regions.indexOf(region.identifier)
      }
    }
  })
  function getBucketName (region) {
    return `${resourceTypeName}-${options.account}-${region}`
  }
  function logger (type) {
    return (content) => {
      if (options.logs && !options.quiet) {
        console[type](content)
      }
    }
  }
  function getAccountId (idDone) {
    if (options.account) {
      log(`Account ID was manually set as: ${options.account}`)
      return idDone(null, options.account)
    }
    log('Calling sts:GetCallerIdentity to see ARN and AccountId...')
    new AWS.STS().getCallerIdentity({}, (err, callerIdentity) => {
      if (err) {
        error('Could not complete sts:GetCallerIdentity.')
        error(err)
        return idDone(err)
      }
      log('Executed sts:GetCallerIdentity: ')
      log(callerIdentity)
      idDone(null, callerIdentity.Arn.replace(/arn:aws:.*::(.*?):.*/, '$1'))
    })
  }
}

function zip(zippableDir, zipDone) {
  const zipChunks = [];
	const archive = archiver('zip');
	var converter = new stream.Writable({
	  write: function (chunk, encoding, next) {
	    zipChunks.push(chunk);
	    next()
	}});
	converter.on('finish', function () {
    zipDone(null, Buffer.concat(zipChunks))
  })
  converter.on('error', zipDone)
  archive.on('error', zipDone)
	archive.directory(zippableDir, '')
	archive.pipe(converter)
	archive.finalize()
}
