output "service_url" {
  description = "Public API base URL (ALB DNS name with http://)."
  value       = "http://${aws_lb.api.dns_name}"
}

output "alb_dns_name" {
  description = "Raw ALB DNS name — use this as a CNAME target in Route 53."
  value       = aws_lb.api.dns_name
}

output "rds_endpoint" {
  description = "RDS instance endpoint (host:port). Used to construct DATABASE_URL."
  value       = aws_db_instance.postgres.endpoint
}

output "rds_port" {
  description = "RDS instance port."
  value       = aws_db_instance.postgres.port
}

output "rds_db_name" {
  description = "Database name on the RDS instance."
  value       = aws_db_instance.postgres.db_name
}

output "ecr_repository_url" {
  description = "ECR repository URL. Push images here before deploying: docker push <url>:<tag>"
  value       = aws_ecr_repository.service.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN."
  value       = aws_ecr_repository.service.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name. Used in CI/CD deploy commands."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name. Used in CI/CD deploy commands."
  value       = aws_ecs_service.api.name
}

output "ecs_execution_role_arn" {
  description = "ARN of the ECS task execution IAM role."
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task IAM role (used by the application process)."
  value       = aws_iam_role.ecs_task.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name for ECS container logs."
  value       = aws_cloudwatch_log_group.api.name
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN for DATABASE_URL. Reference this in other task definitions."
  value       = aws_secretsmanager_secret.database_url.arn
}
