# AWS Deployment Guide - Copy & Paste Commands

This guide provides exact commands to deploy Akara Studio to AWS. Simply copy and paste these commands in order.

## Prerequisites Check

First, verify your AWS setup:

```bash
# Check AWS CLI is configured
aws sts get-caller-identity

# Check Terraform is installed
terraform version

# Should show your AWS account ID and region
```

## 1. Deploy Infrastructure (Production)

```bash
cd /Users/amitrath/akara-aws-deploy/akara/infra

# Create terraform.tfvars file
cat > terraform.tfvars << 'EOF'
aws_region   = "us-east-1"
environment  = "prod"
project_name = "akara"
domain_name  = "akara.studio"
enable_deletion_protection = true
EOF

# Initialize Terraform
terraform init

# Plan deployment (review what will be created)
terraform plan -var-file="terraform.tfvars"

# Deploy infrastructure
terraform apply -var-file="terraform.tfvars" -auto-approve

# Save outputs for later use
terraform output -json > ../infrastructure-outputs.json
```

## 2. Build and Deploy Frontend

```bash
cd /Users/amitrath/akara-aws-deploy/akara/frontend

# Get S3 bucket name from Terraform output
export S3_BUCKET_FRONTEND=$(cd ../infra && terraform output -raw s3_bucket_public)
export CLOUDFRONT_ID=$(cd ../infra && terraform output -raw cloudfront_distribution_id)
export CLOUDFRONT_DOMAIN=$(cd ../infra && terraform output -raw cloudfront_domain_name)

# Create production environment file
cat > .env.local << EOF
NEXT_PUBLIC_CDN_URL=https://$CLOUDFRONT_DOMAIN
NEXT_PUBLIC_API_URL=https://api.akara.studio
NEXT_PUBLIC_SITE_URL=https://akara.studio
NEXT_PUBLIC_ENVIRONMENT=production
EOF

# Install dependencies and build
npm install
npm run build

# Deploy to S3
aws s3 sync out/ s3://$S3_BUCKET_FRONTEND --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "sitemap.xml" --exclude "robots.txt"

aws s3 sync out/ s3://$S3_BUCKET_FRONTEND --delete \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" --include "sitemap.xml" --include "robots.txt"

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

echo "Frontend deployed to: https://$CLOUDFRONT_DOMAIN"
```

## 3. Upload Sample Catalogs

```bash
cd /Users/amitrath/akara-aws-deploy/akara

# Upload sample catalog data
aws s3 cp catalogs/sample-data/ s3://$S3_BUCKET_FRONTEND/catalogs/ --recursive

# Invalidate catalog cache
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/catalogs/*"

echo "Sample catalogs uploaded successfully"
```

## 4. Build and Deploy Admin

```bash
cd /Users/amitrath/akara-aws-deploy/akara/admin

# Get Cognito details from Terraform output
export COGNITO_USER_POOL_ID=$(cd ../infra && terraform output -raw cognito_user_pool_id)
export COGNITO_CLIENT_ID=$(cd ../infra && terraform output -raw cognito_client_id)
export S3_BUCKET_ADMIN=$(cd ../infra && terraform output -raw s3_bucket_media)

# Create admin environment file
cat > .env.local << EOF
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
NEXT_PUBLIC_API_URL=https://api.akara.studio
NEXT_PUBLIC_S3_BUCKET=$S3_BUCKET_ADMIN
NEXT_PUBLIC_ENVIRONMENT=production
EOF

# Install dependencies and build
npm install
npm run build

# Create admin S3 bucket if not exists (simple hosting)
aws s3 mb s3://akara-admin-prod 2>/dev/null || true
aws s3 website s3://akara-admin-prod --index-document index.html --error-document error.html

# Deploy admin to S3
aws s3 sync out/ s3://akara-admin-prod --delete

echo "Admin deployed to: http://akara-admin-prod.s3-website-us-east-1.amazonaws.com"
```

## 5. Create CloudFront Distribution for Admin

```bash
# Create CloudFront distribution for admin
cat > admin-cloudfront-config.json << 'EOF'
{
  "CallerReference": "akara-admin-$(date +%s)",
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
    }
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# Create the distribution
aws cloudfront create-distribution --distribution-config file://admin-cloudfront-config.json > admin-cloudfront-result.json

# Extract admin CloudFront domain
export ADMIN_CLOUDFRONT_DOMAIN=$(cat admin-cloudfront-result.json | jq -r '.Distribution.DomainName')

echo "Admin CloudFront URL: https://$ADMIN_CLOUDFRONT_DOMAIN"
```

## 6. Get Final URLs and DNS Records

```bash
cd /Users/amitrath/akara-aws-deploy/akara

# Display all important URLs
echo "=================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=================================="
echo ""
echo "Frontend (Public Site):"
echo "CloudFront URL: https://$CLOUDFRONT_DOMAIN"
echo ""
echo "Admin Interface:"
echo "CloudFront URL: https://$ADMIN_CLOUDFRONT_DOMAIN"
echo ""
echo "=================================="
echo "DNS RECORDS FOR SQUARESPACE:"
echo "=================================="
echo ""
echo "1. For akara.studio (A Record or CNAME):"
echo "   Type: CNAME"
echo "   Name: @"
echo "   Value: $CLOUDFRONT_DOMAIN"
echo ""
echo "2. For admin.akara.studio (CNAME):"
echo "   Type: CNAME" 
echo "   Name: admin"
echo "   Value: $ADMIN_CLOUDFRONT_DOMAIN"
echo ""
echo "=================================="
echo "NEXT STEPS:"
echo "=================================="
echo "1. Test the CloudFront URLs above"
echo "2. Copy the DNS records into Squarespace"
echo "3. Wait for DNS propagation (5-30 minutes)"
echo "4. Visit https://akara.studio and https://admin.akara.studio"
echo ""

# Save all info to file
cat > DEPLOYMENT-RESULTS.txt << EOF
Akara Studio - AWS Deployment Results
=====================================

Frontend URL: https://$CLOUDFRONT_DOMAIN
Admin URL: https://$ADMIN_CLOUDFRONT_DOMAIN

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

AWS Resources Created:
---------------------
- S3 Buckets: $(cd infra && terraform output -raw s3_bucket_public), akara-admin-prod
- CloudFront Distributions: 2 (frontend + admin)
- DynamoDB Tables: 3 (users, interactions, entitlements)
- Cognito User Pool: $(cd infra && terraform output -raw cognito_user_pool_id)

Deployment Date: $(date)
EOF

echo "All details saved to: DEPLOYMENT-RESULTS.txt"
```

## Summary Commands (All-in-One)

If you want to run everything at once:

```bash
# Navigate to akara directory
cd /Users/amitrath/akara-aws-deploy/akara

# Run the complete deployment
./deploy-all.sh
```

Let me create that deployment script:
