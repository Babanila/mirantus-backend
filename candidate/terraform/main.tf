# Provider, locals, IAM roles, ECS cluster, task definition, ECS service,
# Application Load Balancer, and Secrets Manager secret.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to enable remote state in CI/CD:
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "screening-order-service/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = merge(
      {
        Project     = "screening-order-service"
        Environment = var.environment
        ManagedBy   = "terraform"
      },
      var.tags,
    )
  }
}

# Locals
locals {
  name_prefix = "screening-orders-${var.environment}"

  # DATABASE_URL is constructed at apply time from RDS outputs.
  # It is stored in Secrets Manager — never passed as a plain env var.
  database_url = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# IAM: ECS task execution role
# Used by the ECS agent to pull images from ECR, write to CloudWatch,
# and fetch secrets from Secrets Manager.
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Grant the execution role access to read the DATABASE_URL secret
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.database_url.arn
    }]
  })
}

# IAM: ECS task role
# Used by the application process itself.
# Extend with S3, SQS, or other service policies as the domain grows.
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Secrets Manager
resource "aws_secretsmanager_secret" "database_url" {
  name        = "${local.name_prefix}/database-url"
  description = "PostgreSQL connection string for the Screening Order Service (${var.environment})"

  # production: 30-day recovery window to prevent accidental permanent deletion
  recovery_window_in_days = var.environment == "production" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url

  # Recreate the secret version whenever the RDS endpoint or credentials change
  lifecycle {
    create_before_destroy = true
  }
}

# ECS cluster─
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    # Use FARGATE_SPOT in non-production to reduce cost by ~70%
    capacity_provider = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
    weight            = 1
  }
}

# ECS task definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.service_cpu
  memory                   = var.service_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.service_image
      essential = true
      portMappings = [{
        containerPort = var.api_port
        protocol      = "tcp"
      }]

      # Non-sensitive environment variables passed in plain text
      environment = [
        { name = "NODE_ENV",               value = "production" },
        { name = "API_PORT",               value = tostring(var.api_port) },
        { name = "LOG_LEVEL",              value = var.log_level },
        { name = "CORS_ORIGIN",            value = var.cors_origin },
        { name = "DB_POOL_MAX",            value = "10" },
        { name = "DB_POOL_MIN",            value = "2" },
        { name = "DB_CONNECT_TIMEOUT_MS",  value = "5000" },
      ]

      # DATABASE_URL is injected from Secrets Manager at task launch.
      # It is never stored in the task definition in plain text.
      secrets = [{
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url.arn
      }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "api"
        }
      }

      # Liveness check — mirrors the HEALTHCHECK in the Dockerfile
      healthCheck = {
        command = [
          "CMD", "node", "-e",
          "const h=require('http');const r=h.get({hostname:'localhost',port:${var.api_port},path:'/health',timeout:4000},(res)=>process.exit(res.statusCode===200?0:1));r.on('error',()=>process.exit(1));r.on('timeout',()=>{r.destroy();process.exit(1);})"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 20
      }

      # Run as the non-root 'app' user defined in the Dockerfile
      user = "app"
    }
  ])
}

# ECS service
resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.service_desired_count
  launch_type     = "FARGATE"

  # Rolling deploy: keep 100% healthy during deployment,
  # allow up to 200% (one extra set of tasks) during the transition
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false # tasks live in private subnets
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.api_port
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_execution_managed,
    aws_iam_role_policy.ecs_execution_secrets,
  ]

  lifecycle {
    # Allow CI/CD pipelines to update the image tag without Terraform
    # flagging it as configuration drift on the next plan.
    ignore_changes = [task_definition]
  }
}

# Application Load Balancer
resource "aws_lb" "api" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.subnet_ids

  # Prevent accidental deletion in production
  enable_deletion_protection = var.environment == "production"
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-tg"
  port        = var.api_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # required for awsvpc network mode (Fargate)

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Ensure a new target group is created before the old one is destroyed
  # so the ECS service is never left without a valid target group.
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
