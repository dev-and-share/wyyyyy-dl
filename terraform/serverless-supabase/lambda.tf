# ==========================================
# Lambda (Spring Boot 3 + SnapStart + Supabase)
# 无须 VPC，原生东京机房直通 Supabase，0 待机月费
# ==========================================

# 1. IAM 执行角色
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.project_name}-supa-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 音乐桶读写权限
resource "aws_iam_policy" "lambda_s3_access" {
  name        = "${var.project_name}-supa-lambda-s3-policy"
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

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-backend-supa-${var.environment}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-lambda-supa-logs"
    Component   = "Observability"
    Environment = var.environment
    Flavor      = "supabase"
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

# 3. Lambda 函数定义 (无 VPC 挂载，直接享受原生公网外呼与同城 Supabase 直连)
resource "aws_lambda_function" "spring_app" {
  function_name = "${var.project_name}-backend-supa-${var.environment}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "com.wyyyyydl.StreamLambdaHandler::handleRequest"
  runtime       = "java21"
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  s3_bucket        = aws_s3_bucket.music_bucket.id
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = fileexists(var.lambda_zip_path) ? filebase64sha256(var.lambda_zip_path) : null

  publish = true

  snap_start {
    apply_on = "PublishedVersions"
  }

  environment {
    variables = {
      SPRING_PROFILES_ACTIVE = "aws"
      JAVA_TOOL_OPTIONS      = "-XX:+TieredCompilation -XX:TieredStopAtLevel=1"
      DB_URL                 = "jdbc:postgresql://${var.supabase_db_host}:${var.supabase_db_port}/${var.supabase_db_name}?sslmode=require"
      DB_USER                = var.supabase_db_user
      DB_PASS                = var.supabase_db_password
      DB_DRIVER              = "org.postgresql.Driver"
      S3_BUCKET_NAME         = aws_s3_bucket.music_bucket.id
      CLOUDFRONT_DOMAIN      = aws_cloudfront_distribution.cdn.domain_name
      NETEASE_COOKIE         = var.netease_cookie
    }
  }

  tags = {
    Name        = "${var.project_name}-backend-supa"
    Component   = "Backend"
    Environment = var.environment
    Flavor      = "supabase"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_logs,
    aws_iam_role_policy_attachment.lambda_s3_attach
  ]
}

# 3. 别名 (Alias)
resource "aws_lambda_alias" "prod_alias" {
  name             = "prod"
  description      = "Production alias mapped to latest published version with SnapStart"
  function_name    = aws_lambda_function.spring_app.arn
  function_version = aws_lambda_function.spring_app.version
}
