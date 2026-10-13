# ==========================================
# Lambda (Spring Boot 3 + SnapStart)
# ==========================================

# 1. IAM 执行角色与策略
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.project_name}-lambda-exec-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 挂载 CloudWatch 日志写入权限
resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 挂载 VPC ENI 网络管理权限
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# 挂载 S3 音频桶读写权限
resource "aws_iam_policy" "lambda_s3_access" {
  name        = "${var.project_name}-lambda-s3-policy"
  description = "Grant Lambda read/write access to music S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Effect = "Allow"
        Resource = [
          aws_s3_bucket.music_bucket.arn,
          "${aws_s3_bucket.music_bucket.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_s3_access.arn
}

# CloudWatch 日志组（显式声明与生命周期回收，避免无上限存储开销）
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-backend-rds-${var.environment}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-lambda-rds-logs"
    Component   = "Observability"
    Environment = var.environment
    Flavor      = "vpc-rds"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

# 2. 上传部署包至 S3 (绕过 Lambda API 50MB 直接上传限制)
resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.music_bucket.id
  key    = "deployments/${var.project_name}-backend-${filemd5(var.lambda_zip_path)}.zip"
  source = var.lambda_zip_path
  etag   = filemd5(var.lambda_zip_path)
}

# 3. Lambda 函数定义
resource "aws_lambda_function" "spring_app" {
  function_name = "${var.project_name}-backend-rds-${var.environment}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "com.wyyyyydl.StreamLambdaHandler::handleRequest"
  runtime       = "java21"
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  s3_bucket        = aws_s3_bucket.music_bucket.id
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = fileexists(var.lambda_zip_path) ? filebase64sha256(var.lambda_zip_path) : null

  # 必须设为 true：每次代码变动均生成数字版本号
  publish = true

  # 免费防打爆机制：限制最大并发实例数，彻底防止数据库连接被挤爆
  reserved_concurrent_executions = var.lambda_reserved_concurrency > 0 ? var.lambda_reserved_concurrency : null

  # 开启 SnapStart 快照加速
  snap_start {
    apply_on = "PublishedVersions"
  }

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      SPRING_PROFILES_ACTIVE = "aws"
      JAVA_TOOL_OPTIONS      = "-XX:+TieredCompilation -XX:TieredStopAtLevel=1"
      S3_BUCKET_NAME         = aws_s3_bucket.music_bucket.id
      CLOUDFRONT_DOMAIN      = aws_cloudfront_distribution.cdn.domain_name
      DB_URL                 = var.enable_rds ? "jdbc:postgresql://${aws_db_instance.postgres[0].endpoint}/${var.rds_db_name}" : ""
      DB_USER                = var.enable_rds ? var.rds_username : ""
      DB_PASS                = var.enable_rds ? var.rds_password : ""
    }
  }

  tags = {
    Name        = "${var.project_name}-backend-rds"
    Component   = "Backend"
    Environment = var.environment
    Flavor      = "vpc-rds"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_logs,
    aws_iam_role_policy_attachment.lambda_vpc_access
  ]
}

# 3. 别名 (Alias)：将 prod 指向最新发布的版本，对外提供稳定的 SnapStart 调用目标
resource "aws_lambda_alias" "prod_alias" {
  name             = "prod"
  description      = "Production alias mapped to latest published version with SnapStart"
  function_name    = aws_lambda_function.spring_app.arn
  function_version = aws_lambda_function.spring_app.version
}
