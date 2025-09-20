variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "project" {
  type        = string
  default     = "akara"
  description = "Project name"
}

variable "account_id" {
  type        = string
  description = "AWS account ID"
}

variable "frontend_domain" {
  description = "Custom domain for the frontend"
  type        = string
  default     = "www.akara.studio"
}

variable "admin_domain" {
  description = "Custom domain for the admin"
  type        = string
  default     = "admin.akara.studio"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for the above domains"
  type        = string
}