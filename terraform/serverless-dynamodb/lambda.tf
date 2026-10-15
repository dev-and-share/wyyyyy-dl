# ==========================================
# Lambda (Spring Boot 3 + SnapStart + DynamoDB)
# 无须 VPC，天然具备公网访问能力，0 待机成本
# ==========================================

# 1. IAM 执行角色
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.project_name}-ddb-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 基础日志权限
resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 音乐桶读写权限
resource "aws_iam_policy" "lambda_s3_access" {
  name        = "${var.project_name}-ddb-lambda-s3-policy"
  description = "Grant Lambda read/write access to music S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
      Effect   = "Allow"
      Resource = [aws_s3_bucket.music_bucket.arn, "${aws_s3_bucket.music_bucket.arn}/*"]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_s3_access.arn
}

# DynamoDB 读写权限 (精确授予三张表及其索引)
resource "aws_iam_policy" "lambda_dynamodb_access" {
  name        = "${var.project_name}-ddb-lambda-dynamodb-policy"
  description = "Grant Lambda CRUD access to DynamoDB music tables"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ]
      Effect = "Allow"
      Resource = [
        aws_dynamodb_table.music_history.arn,
        "${aws_dynamodb_table.music_history.arn}/index/*",
        aws_dynamodb_table.music_likes.arn,
        aws_dynamodb_table.music_raw_json.arn,
        aws_dynamodb_table.music_config.arn
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ddb_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_access.arn
}

# CloudWatch 日志组 (7 天自动回收)
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-backend-ddb-${var.environment}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-lambda-ddb-logs"
    Component   = "Observability"
    Environment = var.environment
    Flavor      = "dynamodb"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

# 2. 上传部署包至 S3 (绕过 Lambda API 50MB 直接上传限制)
resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.music_bucket.id
  key    = "deployments/${var.project_name}-backend-${fileexists(var.lambda_zip_path) ? filemd5(var.lambda_zip_path) : "pending"}.zip"
  source = var.lambda_zip_path
  etag   = fileexists(var.lambda_zip_path) ? filemd5(var.lambda_zip_path) : null
}

# 3. Lambda 函数定义 (无 VPC 挂载，直接享受原生公网外呼网易云 API)
resource "aws_lambda_function" "spring_app" {
  function_name = "${var.project_name}-backend-ddb-${var.environment}"
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

  # 开启 SnapStart 快照加速
  snap_start {
    apply_on = "PublishedVersions"
  }

  environment {
    variables = {
      SPRING_PROFILES_ACTIVE = "aws,dynamodb"
      STORAGE_TYPE           = "dynamodb"
      JAVA_TOOL_OPTIONS      = "-XX:+TieredCompilation -XX:TieredStopAtLevel=1"
      DYNAMODB_TABLE_NAME    = aws_dynamodb_table.music_history.name
      DYNAMODB_LIKES_TABLE   = aws_dynamodb_table.music_likes.name
      DYNAMODB_RAW_TABLE     = aws_dynamodb_table.music_raw_json.name
      DYNAMODB_CONFIG_TABLE  = aws_dynamodb_table.music_config.name
      S3_BUCKET_NAME         = aws_s3_bucket.music_bucket.id
      CLOUDFRONT_DOMAIN      = aws_cloudfront_distribution.cdn.domain_name
      NETEASE_COOKIE         = var.netease_cookie
    }
  }

  tags = {
    Name        = "${var.project_name}-backend-ddb"
    Component   = "Backend"
    Environment = var.environment
    Flavor      = "dynamodb"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_logs,
    aws_iam_role_policy_attachment.lambda_s3_attach,
    aws_iam_role_policy_attachment.lambda_ddb_attach
  ]
}

# 3. 别名 (Alias)
resource "aws_lambda_alias" "prod_alias" {
  name             = "prod"
  description      = "Production alias mapped to latest published version with SnapStart"
  function_name    = aws_lambda_function.spring_app.arn
  function_version = aws_lambda_function.spring_app.version
}
