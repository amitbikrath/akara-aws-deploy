#!/bin/bash

# Upload CloudFormation Bootstrap Template to S3
# This script uploads the bootstrap-oidc-role.yaml to S3 and generates the one-click CloudFormation link

set -e

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
BUCKET_NAME=${BUCKET_NAME:-"akara-bootstrap-templates"}
TEMPLATE_FILE="bootstrap-oidc-role.yaml"

echo "🚀 Uploading CloudFormation Bootstrap Template to S3"
echo "=================================================="
echo "AWS Region: $AWS_REGION"
echo "S3 Bucket: $BUCKET_NAME"
echo "Template: $TEMPLATE_FILE"
echo ""

# Check if AWS CLI is configured
echo "📋 Checking AWS credentials..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured or no credentials found"
    echo "Please run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS credentials found for account: $ACCOUNT_ID"
echo ""

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file $TEMPLATE_FILE not found"
    echo "Please run this script from the directory containing $TEMPLATE_FILE"
    exit 1
fi

echo "✅ Template file found: $TEMPLATE_FILE"
echo ""

# Create S3 bucket if it doesn't exist
echo "🪣 Creating S3 bucket: $BUCKET_NAME"
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
    echo "✅ Bucket $BUCKET_NAME already exists"
else
    echo "Creating bucket $BUCKET_NAME in region $AWS_REGION"
    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3 mb s3://$BUCKET_NAME
    else
        aws s3 mb s3://$BUCKET_NAME --region $AWS_REGION
    fi
    echo "✅ Bucket created successfully"
fi

# Enable versioning
echo "📝 Enabling versioning on bucket..."
aws s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled

# Set public read policy for CloudFormation access
echo "🔓 Setting bucket policy for CloudFormation access..."
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFormationAccess",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "$AWS_REGION"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json
echo "✅ Bucket policy applied"

# Upload CloudFormation template
echo ""
echo "📤 Uploading $TEMPLATE_FILE to S3..."
aws s3 cp $TEMPLATE_FILE s3://$BUCKET_NAME/$TEMPLATE_FILE \
    --content-type "text/yaml" \
    --metadata "purpose=cloudformation-template,project=akara-studio"

echo "✅ Template uploaded successfully"

# Generate URLs
S3_TEMPLATE_URL="https://$BUCKET_NAME.s3.$AWS_REGION.amazonaws.com/$TEMPLATE_FILE"
echo ""
echo "📄 S3 Template URL:"
echo "$S3_TEMPLATE_URL"

# Generate CloudFormation Console URLs
ENCODED_URL=$(echo "$S3_TEMPLATE_URL" | sed 's/:/%3A/g' | sed 's/\//%2F/g')
CF_BASE_URL="https://console.aws.amazon.com/cloudformation/home?region=$AWS_REGION#/stacks/create/review"
CF_PARAMS="stackName=akara-github-oidc&param_GitHubOrg=amitbikrath&param_GitHubRepo=akara-aws-deploy&param_ProjectName=akara"
ONE_CLICK_URL="$CF_BASE_URL?templateURL=$ENCODED_URL&$CF_PARAMS"

echo ""
echo "🎉 SUCCESS! CloudFormation Template Ready for Deployment"
echo "======================================================="
echo ""
echo "🔗 ONE-CLICK CLOUDFORMATION DEPLOY LINK:"
echo "$ONE_CLICK_URL"
echo ""
echo "📋 MANUAL CLOUDFORMATION STEPS (if one-click doesn't work):"
echo "1. Go to: https://console.aws.amazon.com/cloudformation/home?region=$AWS_REGION"
echo "2. Create stack → With new resources"
echo "3. Template source: Amazon S3 URL"
echo "4. Amazon S3 URL: $S3_TEMPLATE_URL"
echo "5. Stack name: akara-github-oidc"
echo "6. Parameters:"
echo "   - GitHubOrg: amitbikrath"
echo "   - GitHubRepo: akara-aws-deploy"
echo "   - ProjectName: akara"
echo "7. Check 'I acknowledge...' and create stack"
echo ""
echo "🎯 NEXT STEPS:"
echo "1. Click the one-click link above or follow manual steps"
echo "2. Wait 2-3 minutes for stack completion"
echo "3. Copy the Role ARN from stack outputs"
echo "4. Add as GitHub secret: AWS_ROLE_ARN"
echo "5. Run the 'Deploy Akara Studio to AWS' workflow"
echo ""

# Save to file
cat > cloudformation-deployment-info.txt << EOF
Akara Studio - CloudFormation Bootstrap Deployment
=================================================

Generated: $(date)
AWS Region: $AWS_REGION
S3 Bucket: $BUCKET_NAME
AWS Account: $ACCOUNT_ID

S3 Template URL:
$S3_TEMPLATE_URL

One-Click CloudFormation Deploy:
$ONE_CLICK_URL

Manual Steps:
1. Go to: https://console.aws.amazon.com/cloudformation/home?region=$AWS_REGION
2. Create stack → With new resources
3. Template source: Amazon S3 URL
4. Amazon S3 URL: $S3_TEMPLATE_URL
5. Stack name: akara-github-oidc
6. Parameters:
   - GitHubOrg: amitbikrath
   - GitHubRepo: akara-aws-deploy
   - ProjectName: akara
7. Check 'I acknowledge...' and create stack

Next Steps:
1. Deploy CloudFormation stack
2. Copy Role ARN from outputs
3. Add AWS_ROLE_ARN as GitHub secret
4. Run main deployment workflow
EOF

echo "💾 Deployment info saved to: cloudformation-deployment-info.txt"
echo ""
echo "✨ Ready for deployment! ✨"
