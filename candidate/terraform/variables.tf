# All configurable inputs for the Screening Order Service infrastructure.

# Deployment context
variable "region" {
  description = "AWS region to deploy all resources into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment. Controls naming, tagging, and resource sizing."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be one of: dev, staging, production."
  }
}

# Networking
variable "vpc_id" {
  description = "ID of the existing VPC to deploy ECS tasks and RDS into."
  type        = string

  validation {
    condition     = can(regex("^vpc-[0-9a-f]+$", var.vpc_id))
    error_message = "vpc_id must be a valid AWS VPC ID (e.g. vpc-0a1b2c3d4e5f6g7h8)."
  }
}

variable "subnet_ids" {
  description = <<-EOT
    List of subnet IDs for ECS tasks and RDS.
    Provide subnets in at least two Availability Zones for RDS Multi-AZ support.
    Private subnets are strongly recommended for production.
  EOT
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required (one per AZ for RDS high availability)."
  }
}

# Container image
variable "service_image" {
  description = <<-EOT
    Full container image URI including tag.
    Example: 123456789012.dkr.ecr.us-east-1.amazonaws.com/screening-order-service:1.0.0
    Typically set by the CI/CD pipeline after a successful ECR push.
  EOT
  type        = string
}

# ECS task sizing
variable "service_cpu" {
  description = <<-EOT
    ECS task CPU units.
    Valid Fargate values: 256, 512, 1024, 2048, 4096.
    256 = 0.25 vCPU (dev/staging). 1024 = 1 vCPU (production minimum).
  EOT
  type    = number
  default = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.service_cpu)
    error_message = "service_cpu must be a valid Fargate CPU value: 256, 512, 1024, 2048, or 4096."
  }
}

variable "service_memory" {
  description = <<-EOT
    ECS task memory in MiB.
    Must be compatible with service_cpu.
    See Fargate CPU/memory combinations in the AWS documentation.
  EOT
  type    = number
  default = 512

  validation {
    condition     = var.service_memory >= 512
    error_message = "service_memory must be at least 512 MiB."
  }
}

variable "service_desired_count" {
  description = <<-EOT
    Number of ECS task instances running concurrently.
    Set to 1 in dev to minimise cost.
    Set to 2+ in production for high availability.
  EOT
  type    = number
  default = 1

  validation {
    condition     = var.service_desired_count >= 1
    error_message = "service_desired_count must be at least 1."
  }
}

# RDS
variable "db_instance_class" {
  description = <<-EOT
    RDS instance class.
    dev/staging:  db.t3.micro  (free-tier eligible)
    production:   db.t3.small or larger
  EOT
  type    = string
  default = "db.t3.micro"
}

variable "db_password" {
  description = <<-EOT
    RDS master password. Mark as sensitive — never log or output this value.
    Must be at least 16 characters.
    In production, store in AWS Secrets Manager and reference the ARN.
  EOT
  type      = string
  sensitive = true

  validation {
    condition     = length(var.db_password) >= 16
    error_message = "db_password must be at least 16 characters."
  }
}

variable "db_name" {
  description = "PostgreSQL database name created on the RDS instance."
  type        = string
  default     = "screening_orders"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "orders_user"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for the RDS instance in GiB."
  type        = number
  default     = 20
}

variable "db_multi_az" {
  description = <<-EOT
    Enable RDS Multi-AZ deployment for high availability.
    Always true in production. Set to false in dev to reduce cost.
  EOT
  type    = bool
  default = false
}

# Application
variable "cors_origin" {
  description = <<-EOT
    Allowed CORS origin(s) passed to the container as CORS_ORIGIN.
    Comma-separate multiple origins:
      "https://app.mirantus.com,https://admin.mirantus.com"
  EOT
  type    = string
  default = "http://localhost:5173"
}

variable "log_level" {
  description = "Application log level passed to the container as LOG_LEVEL."
  type        = string
  default     = "info"

  validation {
    condition     = contains(["error", "warn", "info", "debug"], var.log_level)
    error_message = "log_level must be one of: error, warn, info, debug."
  }
}

variable "api_port" {
  description = "Port the NestJS application listens on inside the container."
  type        = number
  default     = 3000
}

# Tagging───────────
variable "tags" {
  description = "Additional tags merged into every resource."
  type        = map(string)
  default     = {}
}
