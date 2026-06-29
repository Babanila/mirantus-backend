# ECR repository for the Screening Order Service container image.
resource "aws_ecr_repository" "service" {
  name                 = "screening-order-service"
  image_tag_mutability = "IMMUTABLE" # prevents tags from being silently overwritten

  image_scanning_configuration {
    scan_on_push = true # automatic CVE scan on every push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Lifecycle policy
# Keeps the last 10 tagged release images.
# Expires untagged (CI build cache) images after 1 day.
resource "aws_ecr_lifecycle_policy" "service" {
  repository = aws_ecr_repository.service.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the last 10 tagged release images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "release-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}

# Repository policy
# Allows the ECS task execution role to pull images.
resource "aws_ecr_repository_policy" "service" {
  repository = aws_ecr_repository.service.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowECSExecutionRolePull"
      Effect = "Allow"
      Principal = {
        AWS = aws_iam_role.ecs_execution.arn
      }
      Action = [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
      ]
    }]
  })
}
