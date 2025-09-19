variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "akara"
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "akara.studio"
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "cognito_google_client_id" {
  description = "Google OAuth client ID for Cognito"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cognito_google_client_secret" {
  description = "Google OAuth client secret for Cognito"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cognito_facebook_client_id" {
  description = "Facebook OAuth client ID for Cognito"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cognito_facebook_client_secret" {
  description = "Facebook OAuth client secret for Cognito"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
