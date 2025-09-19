# IAM Permissions Policy - Akara Studio Deployment

This document outlines the least-privilege IAM permissions granted to the GitHub Actions deployment role.

## Overview

The `akara-deployment-policy` provides the minimum permissions required for GitHub Actions to deploy the complete Akara Studio platform on AWS.

## Permissions Breakdown

### S3 Storage
**Purpose**: Host static frontend, admin interface, and media assets
- **Bucket Management**: Create, delete, configure buckets with encryption and versioning
- **Object Operations**: Upload, download, delete files for deployments
- **Policy Management**: Configure bucket policies for CloudFront access
- **Website Hosting**: Enable static website hosting for admin interface

**Resources**: 
- `arn:aws:s3:::akara-*` (all project buckets)
- `arn:aws:s3:::akara-*/*` (all objects in project buckets)

### CloudFront CDN
**Purpose**: Global content delivery with caching optimization
- **Distribution Management**: Create, update, delete CloudFront distributions
- **Origin Access Control**: Secure S3 bucket access
- **Cache Invalidation**: Clear cache after deployments
- **SSL/TLS**: Manage HTTPS configurations

**Resources**: `*` (CloudFront requires global permissions)

### DynamoDB Database
**Purpose**: Store user data, interactions, and entitlements
- **Table Management**: Create, update, delete tables
- **Index Management**: Create and manage Global Secondary Indexes
- **Tagging**: Resource organization and cost tracking

**Resources**: 
- `arn:aws:dynamodb:*:account:table/akara-*`
- `arn:aws:dynamodb:*:account:table/akara-*/index/*`

### Cognito Authentication
**Purpose**: User authentication and authorization
- **User Pool Management**: Create and configure user pools
- **Client Management**: Configure OAuth clients for frontend/admin
- **Identity Provider**: Set up Google, Facebook OAuth integration
- **Security Policies**: Configure password policies and MFA

**Resources**: `*` (Cognito requires global permissions for pool management)

### EventBridge Events
**Purpose**: Orchestrate media processing workflows
- **Event Bus Management**: Custom event buses for decoupled architecture
- **Rule Management**: Event routing and filtering
- **Target Management**: Connect events to processing functions

**Resources**: `*` (EventBridge requires global permissions)

### ACM Certificates
**Purpose**: SSL/TLS certificates for custom domains
- **Certificate Management**: Request, validate, delete certificates
- **Domain Validation**: Automated certificate validation
- **Tagging**: Certificate organization

**Resources**: `*` (ACM requires global permissions)

### API Gateway (Future)
**Purpose**: Serverless API endpoints for Phase 2+
- **API Management**: Create, update, delete REST and HTTP APIs
- **Resource Management**: Configure API resources and methods
- **Deployment**: Deploy API stages

**Resources**: `*` (API Gateway requires global permissions)

### Lambda Functions (Future)
**Purpose**: Serverless functions for auth, ratings, downloads
- **Function Management**: Create, update, delete Lambda functions
- **Version Control**: Manage function versions and aliases
- **Permissions**: Configure function execution permissions

**Resources**: `arn:aws:lambda:*:account:function:akara-*`

### IAM Service Roles
**Purpose**: Create service roles for AWS services
- **Role Management**: Create roles for Lambda, EventBridge, etc.
- **Policy Attachment**: Attach AWS managed policies to service roles
- **Pass Role**: Allow services to assume created roles

**Resources**: `arn:aws:iam::account:role/akara-*`

### CloudWatch Logs (Monitoring)
**Purpose**: Application logging and monitoring
- **Log Group Management**: Create and configure log groups
- **Retention Policies**: Set log retention periods
- **Tagging**: Organize logging resources

**Resources**: `arn:aws:logs:*:account:log-group:/aws/lambda/akara-*`

### Terraform State (Optional)
**Purpose**: Remote state management for infrastructure
- **State File Access**: Read/write Terraform state files
- **Locking**: Prevent concurrent state modifications
- **Encryption**: Ensure state files are encrypted

**Resources**: 
- `arn:aws:s3:::akara-terraform-state`
- `arn:aws:s3:::akara-terraform-state/*`

## Security Considerations

### Least Privilege Principles
1. **Resource Scoping**: All permissions scoped to `akara-*` resources where possible
2. **Action Limitation**: Only actions required for deployment and operation
3. **Condition Constraints**: Additional conditions on sensitive operations
4. **No Admin Access**: No broad administrative permissions granted

### OIDC Trust Relationship
- **Repository Restriction**: Only the specified GitHub repository can assume the role
- **Branch Limitation**: Only `main` and `develop` branches plus pull requests
- **Audience Validation**: Ensures tokens are from GitHub Actions

### Encryption Requirements
- **S3**: All buckets use AES-256 encryption by default
- **DynamoDB**: Encryption at rest enabled
- **CloudFront**: HTTPS redirect enforced
- **Certificates**: TLS 1.2+ minimum for all connections

## Compliance and Auditing

### Resource Tagging
All created resources are tagged with:
- `Project`: akara
- `Environment`: prod/staging/dev
- `ManagedBy`: terraform

### CloudTrail Integration
All API calls made by the deployment role are logged in CloudTrail for:
- Security auditing
- Compliance reporting
- Troubleshooting deployments

### Cost Management
- **Resource Limits**: Permissions scoped to prevent excessive resource creation
- **Budget Alerts**: CloudWatch alarms on cost thresholds
- **Lifecycle Policies**: Automated cleanup of temporary resources

## Permission Updates

To modify permissions:
1. Update the `AkaraDeploymentPolicy` in `bootstrap-oidc-role.yaml`
2. Deploy the updated CloudFormation stack
3. Test deployment workflow with new permissions
4. Update this documentation

## Validation

The policy has been validated against:
- AWS IAM Policy Simulator
- Terraform plan operations
- GitHub Actions deployment workflows
- Security best practices from AWS Well-Architected Framework

---

**Last Updated**: Phase 0 - Initial deployment setup
**Policy Version**: 1.0.0
**Review Date**: Every 90 days or after major feature additions
