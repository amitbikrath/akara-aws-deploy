terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket = "akara-terraform-state"
  #   key    = "terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "akara-studio"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  # Naming conventions
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Common tags
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "public" {
  bucket = "${local.name_prefix}-public"
  
  tags = local.common_tags
}

resource "aws_s3_bucket" "media" {
  bucket = "${local.name_prefix}-media"
  
  tags = local.common_tags
}

resource "aws_s3_bucket" "admin" {
  bucket = "${local.name_prefix}-admin"
  
  tags = local.common_tags
}

# S3 Bucket configurations
resource "aws_s3_bucket_versioning" "public" {
  bucket = aws_s3_bucket.public.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "public" {
  bucket = aws_s3_bucket.public.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "admin" {
  bucket = aws_s3_bucket.admin.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "public" {
  name                              = "${local.name_prefix}-public-oac"
  description                       = "OAC for Akara Studio public content"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution for public content
resource "aws_cloudfront_distribution" "public" {
  origin {
    domain_name              = aws_s3_bucket.public.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.public.id
    origin_id                = "S3-${aws_s3_bucket.public.bucket}"
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Akara Studio public content distribution"
  default_root_object = "index.html"

  aliases = var.environment == "prod" ? ["cdn.akara.studio"] : []

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.public.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400   # 1 day
    max_ttl     = 31536000 # 1 year
  }

  # Cache behavior for catalogs (shorter TTL)
  ordered_cache_behavior {
    path_pattern           = "/catalogs/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.public.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 300     # 5 minutes
    max_ttl     = 3600    # 1 hour
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.environment == "prod" ? aws_acm_certificate.main[0].arn : null
    cloudfront_default_certificate = var.environment != "prod"
    ssl_support_method       = var.environment == "prod" ? "sni-only" : null
    minimum_protocol_version = var.environment == "prod" ? "TLSv1.2_2021" : null
  }

  tags = local.common_tags
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "public" {
  bucket = aws_s3_bucket.public.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.public.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.public.arn
          }
        }
      }
    ]
  })
}

# ACM Certificate (only for production)
resource "aws_acm_certificate" "main" {
  count = var.environment == "prod" ? 1 : 0
  
  domain_name               = "akara.studio"
  subject_alternative_names = ["*.akara.studio"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

# DynamoDB Tables
resource "aws_dynamodb_table" "users" {
  name           = "${local.name_prefix}-users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "interactions" {
  name           = "${local.name_prefix}-interactions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "itemId"
  range_key      = "userId"

  attribute {
    name = "itemId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "interactionType"
    type = "S"
  }

  global_secondary_index {
    name            = "user-interactions"
    hash_key        = "userId"
    range_key       = "interactionType"
    projection_type = "ALL"
  }

  tags = local.common_tags
}

resource "aws_dynamodb_table" "entitlements" {
  name           = "${local.name_prefix}-entitlements"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"
  range_key      = "itemId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "itemId"
    type = "S"
  }

  tags = local.common_tags
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"

  alias_attributes = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  schema {
    name     = "email"
    attribute_data_type = "String"
    required = true
    mutable  = true
  }

  schema {
    name     = "name"
    attribute_data_type = "String"
    required = true
    mutable  = true
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${local.name_prefix}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  supported_identity_providers = ["COGNITO", "Google", "Facebook"]

  callback_urls = var.environment == "prod" ? 
    ["https://admin.akara.studio/auth/callback"] : 
    ["http://localhost:3001/auth/callback"]

  logout_urls = var.environment == "prod" ? 
    ["https://admin.akara.studio/auth/logout"] : 
    ["http://localhost:3001/auth/logout"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# EventBridge Custom Bus
resource "aws_cloudwatch_event_bus" "main" {
  name = "${local.name_prefix}-events"
  tags = local.common_tags
}

# Outputs
output "s3_bucket_public" {
  description = "Public S3 bucket name"
  value       = aws_s3_bucket.public.bucket
}

output "s3_bucket_media" {
  description = "Media S3 bucket name"
  value       = aws_s3_bucket.media.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.public.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.public.domain_name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    users        = aws_dynamodb_table.users.name
    interactions = aws_dynamodb_table.interactions.name
    entitlements = aws_dynamodb_table.entitlements.name
  }
}
