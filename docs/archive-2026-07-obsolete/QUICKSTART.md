# Akara Studio - Quick Start Guide

This guide will help you get the Akara Studio platform up and running quickly.

## Prerequisites

- Node.js 18+ and npm 9+
- AWS CLI configured with appropriate permissions
- Terraform 1.6+ (for infrastructure)
- Git

## 1. Clone and Setup

```bash
# Navigate to the akara directory
cd akara

# Install root dependencies
npm install

# Install all workspace dependencies
npm install --workspaces
```

## 2. Environment Configuration

### Frontend
```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` with your values:
```env
NEXT_PUBLIC_CDN_URL=https://your-cloudfront-domain.cloudfront.net
NEXT_PUBLIC_API_URL=https://your-api-gateway-url
NEXT_PUBLIC_SITE_URL=https://akara.studio
```

### Admin
```bash
cd admin
cp .env.example .env.local
```

Edit `.env.local` with your AWS Cognito details after infrastructure deployment.

### Lambdas
```bash
cd lambdas
cp .env.example .env
```

## 3. Infrastructure Deployment

```bash
cd infra

# Copy and edit variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var="environment=dev"

# Apply infrastructure
terraform apply -var="environment=dev"

# Note the outputs - you'll need these for environment variables
terraform output
```

## 4. Development

### Start Frontend (Public Site)
```bash
npm run dev:frontend
# Opens at http://localhost:3000
```

### Start Admin Interface
```bash
npm run dev:admin  
# Opens at http://localhost:3001
```

### Build Everything
```bash
npm run build:frontend
npm run build:admin
npm run build:lambdas
```

## 5. Upload Sample Data

After infrastructure is deployed, upload the sample catalogs:

```bash
# Upload sample catalogs to S3
aws s3 cp catalogs/sample-data/ s3://your-public-bucket/catalogs/ --recursive

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/catalogs/*"
```

## 6. Verify Deployment

1. **Frontend**: Visit your CloudFront domain to see the public site
2. **Admin**: Visit your admin domain to access the admin interface
3. **API**: Test API endpoints using the API Gateway URL
4. **Data**: Verify wallpapers and music load from the sample catalogs

## Directory Structure

```
akara/
├── frontend/          # Public site (Next.js)
│   ├── src/app/       # App Router pages
│   ├── src/components/ # React components
│   └── src/lib/       # Utilities and helpers
├── admin/            # Admin interface (Next.js)
│   ├── src/app/       # Admin pages
│   └── src/components/ # Admin components
├── lambdas/          # Serverless functions
│   ├── src/auth/      # Authentication functions
│   ├── src/publish/   # Publishing pipeline
│   └── src/shared/    # Shared utilities
├── infra/            # Terraform infrastructure
├── catalogs/         # Data schemas and samples
│   ├── schemas/       # JSON schemas
│   └── sample-data/   # Sample catalog data
└── .github/workflows/ # CI/CD pipelines
```

## Common Commands

```bash
# Development
npm run dev:frontend    # Start frontend dev server
npm run dev:admin      # Start admin dev server

# Building
npm run build:frontend # Build frontend for production
npm run build:admin   # Build admin for production
npm run build:lambdas # Build lambda functions

# Infrastructure
npm run deploy:infra  # Deploy infrastructure changes

# Deployment (via CI/CD)
npm run deploy:frontend # Deploy frontend to S3+CloudFront
npm run deploy:admin   # Deploy admin to S3
npm run deploy:lambdas # Deploy lambda functions

# Utilities
npm run lint          # Lint all workspaces
npm run type-check    # Type check all workspaces
npm run clean         # Clean all build artifacts
```

## Environment-Specific Deployments

### Development
- Uses local development servers
- Sample data and mock APIs
- No real AWS resources needed for basic development

### Staging
- Full AWS infrastructure
- Separate S3 buckets and CloudFront distributions
- Integration testing environment

### Production
- Production AWS infrastructure
- Custom domains (akara.studio, admin.akara.studio)
- Full monitoring and logging

## Next Steps

1. **Customize Design**: Update the Tailwind theme and components
2. **Add Real Content**: Replace sample data with your actual wallpapers and music
3. **Configure Auth**: Set up Google/Facebook OAuth in Cognito
4. **Enable Features**: Turn on ratings, downloads, and premium features
5. **Monitoring**: Set up CloudWatch alarms and dashboards

## Troubleshooting

### Build Issues
- Ensure Node.js 18+ is installed
- Clear node_modules and reinstall: `npm run clean && npm install`
- Check environment variables are set correctly

### Infrastructure Issues
- Verify AWS credentials: `aws sts get-caller-identity`
- Check Terraform state: `terraform plan`
- Review CloudWatch logs for Lambda errors

### Deployment Issues
- Check GitHub Actions logs for CI/CD failures
- Verify S3 bucket policies and CloudFront distributions
- Ensure environment secrets are configured in GitHub

## Support

- Check the main README.md for architecture details
- Review the schemas in `catalogs/schemas/` for data formats
- Examine sample data in `catalogs/sample-data/` for examples
