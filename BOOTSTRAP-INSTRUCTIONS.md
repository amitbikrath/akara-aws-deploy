# 🚀 CloudFormation Bootstrap Setup (No Terminal Required)

AWS CloudFormation doesn't accept GitHub raw URLs due to MIME type restrictions. Here are two no-terminal solutions:

## Option 1: Automatic S3 Upload (Recommended)

### Step 1: Run Bootstrap Workflow
1. **Go to GitHub Actions**: https://github.com/amitbikrath/akara-aws-deploy/actions
2. **Click**: "Bootstrap CloudFormation Template to S3" workflow
3. **Click**: "Run workflow" 
4. **Configure**:
   - AWS Region: `us-east-1` (or your preferred region)
   - S3 Bucket Name: `akara-bootstrap-templates` (or your choice)
5. **Click**: "Run workflow"

**Note**: This workflow will use your AWS CLI credentials if configured, or you can run it after setting up basic AWS access.

### Step 2: Get Your One-Click Link
After the workflow completes:
1. **Check the workflow logs** for the generated CloudFormation link
2. **Download the artifacts** containing the deployment instructions
3. **Click the one-click link** to deploy

---

## Option 2: Manual Upload to AWS Console (Backup)

If you prefer to upload the template manually:

### Step 1: Download Template
1. **Download**: [bootstrap-oidc-role.yaml](https://github.com/amitbikrath/akara-aws-deploy/raw/main/bootstrap-oidc-role.yaml)
2. **Save** to your local machine

### Step 2: Create Stack Manually
1. **Go to CloudFormation Console**: https://console.aws.amazon.com/cloudformation/home?region=us-east-1
2. **Click**: "Create stack" → "With new resources (standard)"
3. **Template source**: "Upload a template file"
4. **Choose file**: Select the downloaded `bootstrap-oidc-role.yaml`
5. **Click**: "Next"
6. **Stack name**: `akara-github-oidc`
7. **Parameters**:
   - **GitHubOrg**: `amitbikrath`
   - **GitHubRepo**: `akara-aws-deploy`
   - **ProjectName**: `akara`
8. **Click**: "Next" → "Next"
9. **Acknowledge**: Check "I acknowledge that AWS CloudFormation might create IAM resources"
10. **Click**: "Create stack"

### Step 3: Get Role ARN
1. **Wait** 2-3 minutes for stack creation
2. **Go to Outputs tab**
3. **Copy** the `GitHubActionsRoleArn` value

---

## After CloudFormation Stack is Created

### Step 1: Add GitHub Secret
1. **Go to**: https://github.com/amitbikrath/akara-aws-deploy/settings/secrets/actions
2. **Click**: "New repository secret"
3. **Name**: `AWS_ROLE_ARN`
4. **Value**: Paste the Role ARN from CloudFormation outputs
5. **Click**: "Add secret"

### Step 2: Run Main Deployment
1. **Go to Actions**: https://github.com/amitbikrath/akara-aws-deploy/actions
2. **Click**: "Deploy Akara Studio to AWS" workflow
3. **Click**: "Run workflow"
4. **Configure**:
   - Environment: `prod`
   - Deploy infrastructure: ✅ `true`
   - Deploy frontend: ✅ `true`
   - Deploy admin: ✅ `true`
   - Upload sample data: ✅ `true`
5. **Click**: "Run workflow"

### Step 3: Get Your URLs
After deployment (15-20 minutes):
1. **Check workflow summary** for:
   - 🌐 Frontend CloudFront URL
   - 👤 Admin CloudFront URL
   - 📋 DNS records for Squarespace

---

## Troubleshooting

### Bootstrap Workflow Fails
- **Cause**: No AWS credentials configured
- **Solution**: Configure AWS CLI locally or use Option 2 (manual upload)

### CloudFormation Template Invalid
- **Cause**: MIME type or URL encoding issues
- **Solution**: Use Option 2 (manual file upload) instead

### GitHub Actions Permission Denied
- **Cause**: AWS_ROLE_ARN secret not set correctly
- **Solution**: Verify the Role ARN is exactly as shown in CloudFormation outputs

---

## What Gets Created

### AWS Resources (via CloudFormation):
- ✅ **IAM Role**: `akara-github-actions-role`
- ✅ **OIDC Provider**: GitHub Actions integration
- ✅ **IAM Policy**: Least-privilege permissions for deployment

### S3 Resources (via Bootstrap Workflow):
- ✅ **S3 Bucket**: `akara-bootstrap-templates`
- ✅ **CloudFormation Template**: Properly formatted for AWS
- ✅ **Deployment Instructions**: Complete setup guide

### Final Infrastructure (via Main Workflow):
- ✅ **S3 Buckets**: Frontend, admin, media storage
- ✅ **CloudFront**: Global CDN distributions
- ✅ **DynamoDB**: User and interaction tables
- ✅ **Cognito**: Authentication system

---

## Cost Estimate
- **S3 Bootstrap Bucket**: ~$0.01/month
- **CloudFormation Stack**: Free
- **Main Infrastructure**: $5-25/month (depending on usage)

**Total Setup Time**: 5 minutes + 20 minutes deployment = 25 minutes
