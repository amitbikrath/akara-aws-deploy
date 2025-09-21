terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" { region = var.region }

locals {
  frontend_bucket = "${var.project}-frontend-${var.account_id}-${var.region}"
  admin_bucket    = "${var.project}-admin-${var.account_id}-${var.region}"
}

# Buckets for static sites
resource "aws_s3_bucket" "frontend" {
  bucket        = local.frontend_bucket
  force_destroy = true
  tags = { Project = var.project }
}

resource "aws_s3_bucket" "admin" {
  bucket        = local.admin_bucket
  force_destroy = true
  tags = { Project = var.project }
}

# Block public ACLs/Policies (we'll use CloudFront OAC)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_public_access_block" "admin" {
  bucket                  = aws_s3_bucket.admin.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project}-oac"
  description                       = "OAC for ${var.project}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Bucket policies to allow CloudFront via OAC
data "aws_iam_policy_document" "frontend_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_policy.json
}

data "aws_iam_policy_document" "admin_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.admin.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.admin.arn]
    }
  }
}
resource "aws_s3_bucket_policy" "admin" {
  bucket = aws_s3_bucket.admin.id
  policy = data.aws_iam_policy_document.admin_policy.json
}

# CloudFront distributions (default index.html)
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  comment             = "${var.project}-frontend"
  default_root_object = "index.html"
  aliases             = [var.frontend_domain]

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "assets-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    target_origin_id       = "frontend-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET","HEAD"]
    cached_methods         = ["GET","HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/content/*"
    target_origin_id       = "assets-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET","HEAD"]
    cached_methods         = ["GET","HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  tags = { Project = var.project }
}

resource "aws_cloudfront_distribution" "admin" {
  enabled             = true
  comment             = "${var.project}-admin"
  default_root_object = "index.html"
  aliases             = [var.admin_domain]

  origin {
    domain_name              = aws_s3_bucket.admin.bucket_regional_domain_name
    origin_id                = "admin-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "assets-origin-admin"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    target_origin_id       = "admin-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET","HEAD"]
    cached_methods         = ["GET","HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/content/*"
    target_origin_id       = "assets-origin-admin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET","HEAD"]
    cached_methods         = ["GET","HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  tags = { Project = var.project }
}

# S3 Assets Bucket
resource "aws_s3_bucket" "assets" {
  bucket        = "${var.project}-assets-${var.account_id}-${var.region}"
  force_destroy = true
  tags = { Project = var.project }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Assets bucket policy to allow CloudFront via OAC
data "aws_iam_policy_document" "assets_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [
        aws_cloudfront_distribution.frontend.arn,
        aws_cloudfront_distribution.admin.arn
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = data.aws_iam_policy_document.assets_policy.json
}

# DynamoDB Tables
resource "aws_dynamodb_table" "catalog" {
  name           = "${var.project}-catalog"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = { Project = var.project }
}

resource "aws_dynamodb_table" "users" {
  name           = "${var.project}-users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = { Project = var.project }
}

resource "aws_dynamodb_table" "orders" {
  name           = "${var.project}-orders"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }

  tags = { Project = var.project }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-users"

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  tags = { Project = var.project }
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]
  
  callback_urls = [
    "https://${var.admin_domain}/auth/callback",
    "http://localhost:3001/auth/callback"
  ]
  
  logout_urls = [
    "https://${var.admin_domain}/auth/logout",
    "http://localhost:3001/auth/logout"
  ]
}

# IAM Role for Lambda execution
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project}-lambda-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = { Project = var.project }
}

resource "aws_iam_role_policy" "lambda_execution" {
  name = "${var.project}-lambda-execution"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.catalog.arn,
          aws_dynamodb_table.users.arn,
          aws_dynamodb_table.orders.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })
}

# API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
  description   = "Akara Studio API"

  cors_configuration {
    allow_credentials = true
    allow_headers     = ["*"]
    allow_methods     = ["*"]
    allow_origins     = [
      "https://${var.frontend_domain}",
      "https://${var.admin_domain}",
      "http://localhost:3000",
      "http://localhost:3001"
    ]
    max_age = 86400
  }

  tags = { Project = var.project }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "prod"
  auto_deploy = true

  tags = { Project = var.project }
}

# Cognito Authorizer
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# Lambda Functions
resource "aws_lambda_function" "get_upload_url" {
  filename         = "${path.module}/get_upload_url.zip"
  function_name    = "${var.project}-get-upload-url"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  # force update when ZIP changes
  source_code_hash = filebase64sha256("${path.module}/get_upload_url.zip")

  environment {
    variables = {
      ASSETS_BUCKET = aws_s3_bucket.assets.bucket
      AWS_REGION    = var.region
    }
  }

  # ensure bucket exists before Lambda creation
  depends_on = [
    aws_s3_bucket.assets
  ]

  tags = { Project = var.project }
}

resource "aws_lambda_function" "get_catalog" {
  filename         = "${path.module}/get_catalog.zip"
  function_name    = "${var.project}-get-catalog"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  source_code_hash = filebase64sha256("${path.module}/get_catalog.zip")

  environment {
    variables = {
      CATALOG_TABLE = aws_dynamodb_table.catalog.name
      AWS_REGION    = var.region
    }
  }

  depends_on = [
    aws_dynamodb_table.catalog
  ]

  tags = { Project = var.project }
}

resource "aws_lambda_function" "post_catalog" {
  filename         = "${path.module}/post_catalog.zip"
  function_name    = "${var.project}-post-catalog"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30

  source_code_hash = filebase64sha256("${path.module}/post_catalog.zip")

  environment {
    variables = {
      CATALOG_TABLE = aws_dynamodb_table.catalog.name
      AWS_REGION    = var.region
    }
  }

  depends_on = [
    aws_dynamodb_table.catalog
  ]

  tags = { Project = var.project }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "get_upload_url" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_upload_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "get_catalog" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_catalog.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "post_catalog" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_catalog.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "get_upload_url" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_upload_url.invoke_arn
}

resource "aws_apigatewayv2_integration" "get_catalog" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_catalog.invoke_arn
}

resource "aws_apigatewayv2_integration" "post_catalog" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.post_catalog.invoke_arn
}

# API Routes
resource "aws_apigatewayv2_route" "get_upload_url" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/upload-url"
  target    = "integrations/${aws_apigatewayv2_integration.get_upload_url.id}"
  authorization_type = "JWT"
  authorizer_id = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "get_catalog" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/catalog"
  target    = "integrations/${aws_apigatewayv2_integration.get_catalog.id}"
}

resource "aws_apigatewayv2_route" "post_catalog" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /api/catalog"
  target    = "integrations/${aws_apigatewayv2_integration.post_catalog.id}"
  authorization_type = "JWT"
  authorizer_id = aws_apigatewayv2_authorizer.cognito.id
}

output "frontend_bucket"         { value = aws_s3_bucket.frontend.bucket }
output "admin_bucket"            { value = aws_s3_bucket.admin.bucket }
output "assets_bucket_name"      { value = aws_s3_bucket.assets.bucket }
output "frontend_distribution_id"{ value = aws_cloudfront_distribution.frontend.id }
output "admin_distribution_id"   { value = aws_cloudfront_distribution.admin.id }
output "frontend_domain"         { value = aws_cloudfront_distribution.frontend.domain_name }
output "admin_domain"            { value = aws_cloudfront_distribution.admin.domain_name }
output "api_base_url"            { value = aws_apigatewayv2_stage.main.invoke_url }
output "cognito_user_pool_id"    { value = aws_cognito_user_pool.main.id }
output "cognito_user_pool_client_id" { value = aws_cognito_user_pool_client.main.id }
output "aws_region"              { value = var.region }