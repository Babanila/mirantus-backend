# Screening Order Service — Terraform Module

Provisions the AWS infrastructure for the Screening Order Service on
**ECS Fargate** backed by **RDS PostgreSQL 15**.

## Architecture

```
        Internet
            │  port 80
            ▼
┌─────────────────────┐
│  Application Load   │  security_group: alb
│  Balancer (ALB)     │
└──────────┬──────────┘
           │  port var.api_port
           ▼
┌─────────────────────┐
│  ECS Fargate Tasks  │  security_group: ecs_tasks
│  (NestJS API)       │  execution_role: ecs_execution (ECR, CW, Secrets)
│                     │  task_role:      ecs_task      (app permissions)
└──────────┬──────────┘
           │  port 5432
           ▼
┌─────────────────────┐
│  RDS PostgreSQL 15  │  security_group: rds
│                     │  encrypted storage (gp3)
│                     │  automated backups
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  CloudWatch Logs    │  /ecs/screening-orders-<env>-api
│  + Metric Alarms    │  running tasks, 5xx errors, p99 latency
└─────────────────────┘

DATABASE_URL → AWS Secrets Manager (never in plain-text env var)
Container image → ECR (immutable tags, scan on push, lifecycle policy)
```

## Prerequisites

| Tool      | Minimum version |
|-----------|----------------|
| Terraform | >= 1.6.0       |
| AWS CLI   | >= 2.0         |

Configure AWS credentials before running any Terraform command:

```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1
```

## Usage

```bash
cd candidate/terraform

terraform init

terraform plan \
  -var="environment=dev" \
  -var="vpc_id=vpc-0a1b2c3d4e5f6g7h8" \
  -var='subnet_ids=["subnet-00000001","subnet-00000002"]' \
  -var="db_password=supersecretpassword99!!" \
  -var="service_image=123456789012.dkr.ecr.us-east-1.amazonaws.com/screening-order-service:1.0.0"

terraform apply \
  -var="environment=dev" \
  -var="vpc_id=vpc-0a1b2c3d4e5f6g7h8" \
  -var='subnet_ids=["subnet-00000001","subnet-00000002"]' \
  -var="db_password=supersecretpassword99!!" \
  -var="service_image=123456789012.dkr.ecr.us-east-1.amazonaws.com/screening-order-service:1.0.0"
```

## Inputs

| Name | Type | Default | Required | Description |
|---|---|---|---|---|
| `region` | string | `us-east-1` | no | AWS region |
| `environment` | string | — | **yes** | `dev`, `staging`, `production` |
| `vpc_id` | string | — | **yes** | Existing VPC ID |
| `subnet_ids` | list(string) | — | **yes** | ≥ 2 subnet IDs (different AZs) |
| `service_image` | string | — | **yes** | ECR image URI with tag |
| `service_cpu` | number | `256` | no | Fargate CPU units |
| `service_memory` | number | `512` | no | Fargate memory MiB |
| `service_desired_count` | number | `1` | no | Running task count |
| `db_instance_class` | string | `db.t3.micro` | no | RDS instance class |
| `db_password` | string | — | **yes** | RDS master password (sensitive, min 16 chars) |
| `db_name` | string | `screening_orders` | no | Database name |
| `db_username` | string | `orders_user` | no | DB master username |
| `db_allocated_storage` | number | `20` | no | Storage in GiB |
| `db_multi_az` | bool | `false` | no | Enable RDS Multi-AZ |
| `cors_origin` | string | `http://localhost:5173` | no | Allowed CORS origin(s) |
| `log_level` | string | `info` | no | `error` \| `warn` \| `info` \| `debug` |
| `api_port` | number | `3000` | no | Container port |
| `tags` | map(string) | `{}` | no | Additional resource tags |

## Outputs

| Name | Description |
|---|---|
| `service_url` | API base URL (`http://<alb-dns>`) |
| `alb_dns_name` | Raw ALB DNS — use as CNAME target in Route 53 |
| `rds_endpoint` | RDS `host:port` |
| `rds_db_name` | Database name |
| `ecr_repository_url` | Push images here before deploying |
| `ecr_repository_arn` | ECR repository ARN |
| `ecs_cluster_name` | For CI/CD `ecs update-service` commands |
| `ecs_service_name` | For CI/CD `ecs update-service` commands |
| `ecs_execution_role_arn` | ECS execution role ARN |
| `ecs_task_role_arn` | ECS task role ARN |
| `cloudwatch_log_group` | Container log group name |
| `database_url_secret_arn` | Secrets Manager ARN for `DATABASE_URL` |

## Acceptance criteria

```bash
cd candidate/terraform

terraform init
# ✅ Initializing provider plugins… hashicorp/aws ~> 5.0

terraform validate
# ✅ Success! The configuration is valid.

terraform plan \
  -var="environment=dev" \
  -var="vpc_id=vpc-00000000" \
  -var='subnet_ids=["subnet-00000001","subnet-00000002"]' \
  -var="db_password=supersecretpassword99!!" \
  -var="service_image=000000000000.dkr.ecr.us-east-1.amazonaws.com/screening-order-service:latest"
# ✅ Plan: N to add, 0 to change, 0 to destroy.
```
