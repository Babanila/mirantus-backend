# RDS PostgreSQL 15 instance, subnet group, and parameter group.
resource "aws_db_subnet_group" "postgres" {
  name        = "${local.name_prefix}-db-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for ${local.name_prefix} RDS instance"
}

resource "aws_db_parameter_group" "postgres" {
  name        = "${local.name_prefix}-db-params"
  family      = "postgres15"
  description = "Parameter group for ${local.name_prefix} Postgres 15"

  # Enforce SSL — the application connects with sslmode=require
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Log queries taking longer than 1 second for performance monitoring
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Log new connections in non-production to aid debugging
  parameter {
    name  = "log_connections"
    value = var.environment == "production" ? "0" : "1"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = "15.6"
  instance_class = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2 # autoscaling ceiling
  storage_type          = "gp3"
  storage_encrypted     = true

  # Credentials
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Networking
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Configuration
  parameter_group_name = aws_db_parameter_group.postgres.name
  multi_az             = var.db_multi_az

  # Backups — 7 days in production, 1 day elsewhere to reduce cost
  backup_retention_period = var.environment == "production" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Protection
  deletion_protection = var.environment == "production"

  # Skip final snapshot in dev/staging; take one in production
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${local.name_prefix}-final-snapshot" : null

  # Performance Insights (production only — small additional cost)
  performance_insights_enabled = var.environment == "production"
}
