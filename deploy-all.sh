#!/bin/bash

# Akara Studio - Complete AWS Deployment Script
# This script deploys the entire Akara Studio platform to AWS

set -e  # Exit on any error

echo "🚀 Starting Akara Studio AWS Deployment..."
echo "=========================================="

# Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install and configure AWS CLI first."
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install Terraform first."
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# 1. Deploy Infrastructure
echo ""
echo "🏗️  Deploying Infrastructure..."
echo "==============================="
cd infra

# Create terraform.tfvars
cat > terraform.tfvars << 'EOF'
aws_region   = "us-east-1"
environment  = "prod"
project_name = "akara"
domain_name  = "akara.studio"
enable_deletion_protection = true
EOF

echo "📝 Created terraform.tfvars"

# Initialize and deploy Terraform
terraform init
echo "✅ Terraform initialized"

terraform plan -var-file="terraform.tfvars"
echo "✅ Terraform plan completed"

terraform apply -var-file="terraform.tfvars" -auto-approve
echo "✅ Infrastructure deployed"

# Save outputs
terraform output -json > ../infrastructure-outputs.json
echo "✅ Infrastructure outputs saved"

# Extract key values
export S3_BUCKET_FRONTEND=$(terraform output -raw s3_bucket_public)
export CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)
export CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_domain_name)
export COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
export COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
export S3_BUCKET_MEDIA=$(terraform output -raw s3_bucket_media)

cd ..

# 2. Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
echo "========================"
cd frontend

# Create production environment file
cat > .env.local << EOF
NEXT_PUBLIC_CDN_URL=https://$CLOUDFRONT_DOMAIN
NEXT_PUBLIC_API_URL=https://api.akara.studio
NEXT_PUBLIC_SITE_URL=https://akara.studio
NEXT_PUBLIC_ENVIRONMENT=production
EOF

echo "📝 Created frontend .env.local"

# Build frontend
npm install
npm run build
echo "✅ Frontend built"

# Deploy to S3
aws s3 sync out/ s3://$S3_BUCKET_FRONTEND --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "sitemap.xml" --exclude "robots.txt"

aws s3 sync out/ s3://$S3_BUCKET_FRONTEND --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" --include "sitemap.xml" --include "robots.txt"

echo "✅ Frontend deployed to S3"

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*" > /dev/null
echo "✅ CloudFront cache invalidated"

cd ..

# 3. Upload Sample Catalogs
echo ""
echo "📚 Uploading Sample Catalogs..."
echo "==============================="

aws s3 cp catalogs/sample-data/ s3://$S3_BUCKET_FRONTEND/catalogs/ --recursive
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/catalogs/*" > /dev/null
echo "✅ Sample catalogs uploaded"

# 4. Deploy Admin
echo ""
echo "👤 Deploying Admin..."
echo "====================="
cd admin

# Create admin environment file
cat > .env.local << EOF
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
NEXT_PUBLIC_API_URL=https://api.akara.studio
NEXT_PUBLIC_S3_BUCKET=$S3_BUCKET_MEDIA
NEXT_PUBLIC_ENVIRONMENT=production
EOF

echo "📝 Created admin .env.local"

# Build admin
npm install
npm run build
echo "✅ Admin built"

# Create and configure admin S3 bucket
aws s3 mb s3://akara-admin-prod 2>/dev/null || echo "Admin bucket already exists"
aws s3 website s3://akara-admin-prod --index-document index.html --error-document error.html

# Deploy admin to S3
aws s3 sync out/ s3://akara-admin-prod --delete
echo "✅ Admin deployed to S3"

cd ..

# 5. Create Admin CloudFront Distribution
echo ""
echo "☁️  Creating Admin CloudFront..."
echo "================================"

# Create CloudFront config for admin
cat > admin-cloudfront-config.json << 'EOF'
{
  "CallerReference": "akara-admin-TIMESTAMP",
  "Comment": "Akara Studio Admin Interface",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-akara-admin-prod",
        "DomainName": "akara-admin-prod.s3-website-us-east-1.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-akara-admin-prod",
    "ViewerProtocolPolicy": "redirect-to-https",
    "MinTTL": 0,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    }
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# Replace timestamp placeholder
sed -i "s/TIMESTAMP/$(date +%s)/g" admin-cloudfront-config.json

# Create admin CloudFront distribution
aws cloudfront create-distribution --distribution-config file://admin-cloudfront-config.json > admin-cloudfront-result.json
export ADMIN_CLOUDFRONT_DOMAIN=$(cat admin-cloudfront-result.json | jq -r '.Distribution.DomainName')
echo "✅ Admin CloudFront distribution created"

# Clean up temp files
rm admin-cloudfront-config.json admin-cloudfront-result.json

# 6. Display Results
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================="
echo ""
echo "📱 Frontend (Public Site):"
echo "   CloudFront URL: https://$CLOUDFRONT_DOMAIN"
echo ""
echo "👤 Admin Interface:"
echo "   CloudFront URL: https://$ADMIN_CLOUDFRONT_DOMAIN"
echo ""
echo "🌐 DNS RECORDS FOR SQUARESPACE:"
echo "==============================="
echo ""
echo "1. For akara.studio:"
echo "   Type: CNAME"
echo "   Name: @"
echo "   Value: $CLOUDFRONT_DOMAIN"
echo ""
echo "2. For admin.akara.studio:"
echo "   Type: CNAME"
echo "   Name: admin"
echo "   Value: $ADMIN_CLOUDFRONT_DOMAIN"
echo ""

# Save results to file
cat > DEPLOYMENT-RESULTS.txt << EOF
Akara Studio - AWS Deployment Results
=====================================

✅ Deployment completed successfully on $(date)

URLs:
-----
Frontend: https://$CLOUDFRONT_DOMAIN
Admin:    https://$ADMIN_CLOUDFRONT_DOMAIN

DNS Records for Squarespace:
---------------------------
1. akara.studio
   Type: CNAME
   Name: @
   Value: $CLOUDFRONT_DOMAIN

2. admin.akara.studio
   Type: CNAME
   Name: admin
   Value: $ADMIN_CLOUDFRONT_DOMAIN

AWS Resources:
--------------
- Frontend S3 Bucket: $S3_BUCKET_FRONTEND
- Admin S3 Bucket: akara-admin-prod
- Media S3 Bucket: $S3_BUCKET_MEDIA
- Frontend CloudFront: $CLOUDFRONT_ID
- Cognito User Pool: $COGNITO_USER_POOL_ID
- Region: us-east-1

Next Steps:
-----------
1. Test the CloudFront URLs above
2. Add DNS records to Squarespace
3. Wait for DNS propagation (5-30 minutes)
4. Visit https://akara.studio and https://admin.akara.studio

EOF

echo "📄 All details saved to: DEPLOYMENT-RESULTS.txt"
echo ""
echo "🚀 Next Steps:"
echo "1. Test the CloudFront URLs above"
echo "2. Copy the DNS records into Squarespace"
echo "3. Wait for DNS propagation (5-30 minutes)"
echo "4. Visit your live site!"
echo ""
echo "✨ Deployment complete! ✨"
