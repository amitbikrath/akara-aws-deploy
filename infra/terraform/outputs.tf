output "placeholder_bucket" {
  description = "Placeholder S3 bucket name"
  value       = aws_s3_bucket.tf_placeholder.bucket
}

output "account_id" {
  description = "AWS Account ID"
  value       = var.account_id
}

output "region" {
  description = "AWS Region"
  value       = var.region
}
