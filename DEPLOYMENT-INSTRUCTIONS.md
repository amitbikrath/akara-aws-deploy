# 🚀 One-Click AWS Deployment Instructions

This document provides the exact steps to deploy Akara Studio to AWS with **zero terminal commands** required.

## 📋 Prerequisites

- AWS Account with billing enabled
- GitHub account (this repository)
- Squarespace account for DNS management

## 🎯 Deployment Steps

### Step 1: Create GitHub OIDC Role (One Click)

Click this link to create the CloudFormation stack:

**🔗 [One-Click CloudFormation Deploy](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://raw.githubusercontent.com/amitrath/akara-aws-deploy/main/bootstrap-oidc-role.yaml&stackName=akara-github-oidc&param_GitHubOrg=amitrath&param_GitHubRepo=akara-aws-deploy&param_ProjectName=akara)**

#### What this does:
- Creates an IAM role for GitHub Actions with least-privilege permissions
- Sets up OIDC trust relationship with GitHub
- Grants permissions for S3, CloudFront, DynamoDB, Cognito, etc.

#### In the Console:
1. The link pre-fills all parameters
2. Scroll down and check "I acknowledge that AWS CloudFormation might create IAM resources"
3. Click **"Create stack"**
4. Wait 2-3 minutes for completion
5. Go to "Outputs" tab and copy the **GitHubActionsRoleArn** value

### Step 2: Add Role ARN to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `AWS_ROLE_ARN`
5. Value: Paste the ARN from CloudFormation outputs (starts with `arn:aws:iam::`)
6. Click **"Add secret"**

### Step 3: Trigger Deployment (One Click)

1. Go to **Actions** tab in GitHub
2. Click **"Deploy Akara Studio to AWS"** workflow
3. Click **"Run workflow"** dropdown
4. Select:
   - **Environment**: `prod`
   - **Deploy infrastructure**: ✅ `true`
   - **Deploy frontend**: ✅ `true`
   - **Deploy admin**: ✅ `true`
   - **Upload sample data**: ✅ `true`
5. Click **"Run workflow"**

### Step 4: Wait for Deployment (10-15 minutes)

The workflow will:
- ✅ Deploy AWS infrastructure (S3, CloudFront, DynamoDB, Cognito)
- ✅ Build and deploy frontend
- ✅ Build and deploy admin interface
- ✅ Upload sample wallpapers and music
- ✅ Generate DNS records

### Step 5: Get Your URLs and DNS Records

After deployment completes:
1. Go to the **Actions** run
2. Check the **Summary** section for:
   - 🌐 **Frontend URL**: `https://d1234567890.cloudfront.net`
   - 👤 **Admin URL**: `https://d0987654321.cloudfront.net`
   - 📋 **DNS Records** (copy these exactly)

### Step 6: Update Squarespace DNS

In Squarespace:
1. Go to **Settings** → **Domains** → **DNS**
2. Add these **CNAME records**:

   **For akara.studio:**
   - Type: `CNAME`
   - Name: `@`
   - Value: `d1234567890.cloudfront.net` (your actual CloudFront domain)

   **For admin.akara.studio:**
   - Type: `CNAME`
   - Name: `admin`
   - Value: `d0987654321.cloudfront.net` (your actual admin CloudFront domain)

3. Save changes

### Step 7: Test Your Site (After DNS Propagation)

Wait 5-30 minutes for DNS propagation, then visit:
- **https://akara.studio** - Your public site with sample wallpapers and music
- **https://admin.akara.studio** - Your admin interface

## 🎉 You're Live!

Your Akara Studio platform is now running on AWS with:
- ✅ Premium wallpaper gallery with filters
- ✅ Vinyl music player with rotating animations
- ✅ Admin interface for content management
- ✅ CDN-optimized global delivery
- ✅ User authentication ready (Cognito)
- ✅ Database for interactions and ratings

## 🔧 Environment Configuration

### Production vs Staging

- **Main branch** → Production environment (`akara.studio`)
- **Develop branch** → Staging environment (`staging.akara.studio`)

### Manual Deployments

You can trigger deployments anytime via:
1. **Actions** → **Deploy Akara Studio to AWS**
2. **Run workflow** with your preferred options

## 📊 What Was Created

### AWS Resources:
- **S3 Buckets**: 3 (frontend, admin, media)
- **CloudFront**: 2 distributions (frontend + admin)
- **DynamoDB**: 3 tables (users, interactions, entitlements)
- **Cognito**: User pool with OAuth ready
- **IAM**: Service roles with least privilege

### Estimated Monthly Cost:
- **Free Tier**: ~$0-5/month (first year)
- **After Free Tier**: ~$10-25/month (depending on usage)

## 🛠️ Troubleshooting

### CloudFormation Stack Creation Failed
- Check you have sufficient IAM permissions in your AWS account
- Ensure billing is enabled
- Try again in `us-east-1` region

### GitHub Actions Failed
- Verify `AWS_ROLE_ARN` secret is set correctly
- Check the role ARN starts with `arn:aws:iam::`
- Ensure CloudFormation stack completed successfully

### DNS Not Working
- Wait up to 48 hours for full DNS propagation
- Test CloudFront URLs directly first
- Verify CNAME records are exact (no trailing dots)

### Need Help?
- Check GitHub Actions logs for detailed error messages
- Review CloudFormation events in AWS Console
- All permissions are documented in `POLICY.md`

---

**🎯 Total Manual Steps**: 3 clicks + 2 copy-pastes + DNS wait time
**🚀 Deployment Time**: ~15 minutes + DNS propagation
**💰 AWS Free Tier**: Covers most usage for first year
