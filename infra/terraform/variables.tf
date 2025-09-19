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