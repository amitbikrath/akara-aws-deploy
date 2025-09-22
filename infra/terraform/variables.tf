// infra/terraform/variables.tf
variable "project" {
  description = "Project short name used in resource names"
  type        = string
}

variable "region" {
  description = "AWS region (e.g., us-east-1)"
  type        = string
}

variable "account_id" {
  description = "AWS Account ID (12 digits)"
  type        = string
}

variable "frontend_domain" {
  description = "Custom domain for the public app"
  type        = string
}

variable "admin_domain" {
  description = "Custom domain for the admin app"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1"
  type        = string
}