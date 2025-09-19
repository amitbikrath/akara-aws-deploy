terraform {
  backend "s3" {
    bucket         = "akara-terraform-state"
    key            = "global/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "akara-tf-locks"
    encrypt        = true
  }
}
