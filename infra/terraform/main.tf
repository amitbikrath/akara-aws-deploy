terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# Placeholder so plan/apply has something trivial to manage (safe, free)
resource "aws_s3_bucket" "tf_placeholder" {
  bucket        = "${var.project}-placeholder-${var.account_id}-${var.region}"
  force_destroy = true
  tags = { 
    Project = var.project 
  }
}