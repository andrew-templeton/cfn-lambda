#!/bin/bash
#############################################
# PLEASE HAVE AN AWS_PROFILE BEFORE RUNNING!
#############################################
# TERMINATES ON ANY ISSUES
set -e;
#############################################
# DEPLOYS TO ALL LAMBDA REGIONS BY DEFAULT
# THERE IS NO COST TO THE USER FOR THIS
REGIONS="us-east-1 us-west-2 eu-west-1 ap-northeast-1";
#############################################
#############################################
#############################################

# Dir the current script is in
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";

# Get package name contexts
VERSION=$(cat "$DIR"'/../../package.json' \
  | python -m json.tool \
  | grep '    "version": "' \
  | sed 's/    "version": "//' \
  | sed 's/"//' \
  | sed 's/,//' \
  | sed 's/\./-/g');
RESOURCE_TYPE=$(cat "$DIR"'/../../package.json' \
  | python -m json.tool \
  | grep '    "name": "' \
  | sed 's/    "name": "//' \
  | sed 's/"//' \
  | sed 's/,//');

# Housekeeping
FULL_NAME="$RESOURCE_TYPE"'-'"$VERSION";
ZIP_LOCATION='/tmp/'"$FULL_NAME"'.zip';
POLICY_ARG='file://'"$DIR"'/../../execution-policy.json';
TRUST_ARG='file://'"$DIR"'/lib/lambda.trust.json';
ZIP_ARG='fileb://'"$ZIP_LOCATION";
LAMBDA_DESC='CloudFormation Custom Resource service for Custom::'"$RESOURCE_TYPE";
# Fastest way to get your Account Number.
ACCOUNT_NUMBER=$(aws iam get-user \
  --output json \
  --region us-east-1 \
  | grep \"Arn\" \
  | sed 's/        "Arn": "arn:aws:iam:://g' \
  | sed 's/:user.*//');
ROLE_ARN='arn:aws:iam::'"$ACCOUNT_NUMBER"':role/'"$FULL_NAME";



echo '~~~~ Deploying Lambda to all regions ('"$REGIONS"'). You may see CREATE errors ~~~~';
echo '~~~~ This is fine, it simply means that the deployment script will run UPDATEs ~~~~';

# Time to bundle repo root
cd $DIR'/../../';
echo '';
echo 'Zipping Lambda bundle...';
zip -r "$ZIP_LOCATION" * > '/dev/null';
echo '';

# Globally Applied
echo 'Creating a Role for the Lambda in IAM...';
aws iam create-role \
  --role-name "$FULL_NAME" \
  --assume-role-policy-document "$TRUST_ARG"  > '/dev/null' || 
aws iam update-assume-role-policy \
  --role-name "$FULL_NAME" \
  --policy-document "$TRUST_ARG" > '/dev/null';
echo 'Upserted Role!';
echo '';

#Globally Applied
echo 'Applying a Policy to the Role...';
aws iam put-role-policy \
  --role-name "$FULL_NAME" \
  --policy-name "$FULL_NAME"'_policy' \
  --policy-document "$POLICY_ARG" > '/dev/null';
echo 'Added Policy!';
echo '';

# Script is literally too fast for IAM to propagate... :P
echo 'Sleeping for 5s to allow IAM propagation...';
for (( i = 1 ; i <= 5 ; i++ )); do
  sleep 1;
  echo '...zzz...';
done 
echo '';

# Globally Applied
echo 'Beginning deploy of Lambdas to Regions: '"$REGIONS";
for REGION in $REGIONS; do
  echo 'Deploying Lambda to: '"$REGION";
  aws --region "$REGION" lambda create-function \
    --function-name "$FULL_NAME" \
    --runtime 'nodejs' \
    --role "$ROLE_ARN" \
    --handler 'index.handler' \
    --description "$LAMBDA_DESC" \
    --timeout '300' \
    --memory-size '128' \
    --zip-file "$ZIP_ARG" > '/dev/null' || \
    aws --region "$REGION" lambda update-function-configuration \
      --function-name "$FULL_NAME" \
      --role "$ROLE_ARN" \
      --handler 'index.handler' \
      --description "$LAMBDA_DESC" \
      --timeout '300' \
      --memory-size '128' > '/dev/null';
    aws --region "$REGION" lambda update-function-code \
      --function-name "$FULL_NAME" \
      --zip-file "$ZIP_ARG" > '/dev/null';
    echo 'Upserted Lambda!';
    echo '';
done

# Whee
echo '';
echo '~~~~ All done! Lambdas are deployed globally and ready for use by CloudFormation. ~~~~';
echo '~~~~                They are accessible to your CloudFormation at:                ~~~~'
echo 'aws:arn:<region>:'"$ACCOUNT_NUMBER"':function:'"$FULL_NAME";
exit 0;

