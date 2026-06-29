# CloudWatch log group and metric alarms for the ECS service.
resource "aws_cloudwatch_log_group" "api" {
  name = "/ecs/${local.name_prefix}-api"
  retention_in_days = var.environment == "production" ? 90 : 7

  # Uncomment to encrypt logs at rest with a KMS customer-managed key:
  # kms_key_id = var.environment == "production" ? var.kms_key_arn : null
}

# Alarm: running task count below desired
resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks_low" {
  alarm_name          = "${local.name_prefix}-running-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.service_desired_count

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }

  alarm_description  = "Fires when fewer ECS tasks are running than desired"
  treat_missing_data = "breaching"

  # Wire to an SNS topic in production:
  alarm_actions = []
  ok_actions    = []
}

# Alarm: ALB HTTP 5xx error rate
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${local.name_prefix}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10

  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }

  alarm_description  = "Fires when the ALB sees more than 10 HTTP 5xx responses per minute"
  treat_missing_data = "notBreaching"
  alarm_actions = []
  ok_actions    = []
}

# Alarm: ALB average response time
resource "aws_cloudwatch_metric_alarm" "alb_latency_high" {
  alarm_name          = "${local.name_prefix}-alb-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p99"
  threshold           = 2

  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }

  alarm_description  = "Fires when p99 response time exceeds 2 seconds"
  treat_missing_data = "notBreaching"
  alarm_actions = []
  ok_actions    = []
}
