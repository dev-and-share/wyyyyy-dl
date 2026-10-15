# ==========================================
# S3 音乐与媒体存储桶
# ==========================================
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "music_bucket" {
  bucket        = "${var.project_name}-music-rds-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-music-rds-storage"
    Component   = "Storage"
    Environment = var.environment
    Flavor      = "vpc-rds"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

# 启用默认服务端加密 (SSE-S3)，满足合规与安全防护
resource "aws_s3_bucket_server_side_encryption_configuration" "music_encryption" {
  bucket = aws_s3_bucket.music_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 开启版本控制，保护音乐库数据防误删
resource "aws_s3_bucket_versioning" "music_versioning" {
  bucket = aws_s3_bucket.music_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 彻底屏蔽外部公共访问，所有读取均通过 CloudFront OAC 签名进入
resource "aws_s3_bucket_public_access_block" "music_bucket_block" {
  bucket                  = aws_s3_bucket.music_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 开启 CORS，保证 Web Audio API 及 HTML5 <audio> 能正常播放与读取 ID3/Range 分片
resource "aws_s3_bucket_cors_configuration" "music_cors" {
  bucket = aws_s3_bucket.music_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"]
    max_age_seconds = 86400
  }
}

# CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.project_name}-s3-oac"
  description                       = "OAC for accessing music files in S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 存储桶策略：仅授权 CloudFront 分发通过 OAC 读取资源
resource "aws_s3_bucket_policy" "allow_cloudfront_oac" {
  bucket = aws_s3_bucket.music_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOACReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.music_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------
# 前端 Svelte 静态资源与页面部署 (托管于 S3)
# ------------------------------------------
locals {
  mime_types = {
    "html" = "text/html; charset=utf-8"
    "css"  = "text/css; charset=utf-8"
    "js"   = "application/javascript; charset=utf-8"
    "json" = "application/json; charset=utf-8"
    "png"  = "image/png"
    "svg"  = "image/svg+xml"
    "ico"  = "image/x-icon"
    "txt"  = "text/plain; charset=utf-8"
  }
}

resource "aws_s3_object" "frontend_svelte_assets" {
  for_each = fileset("${path.module}/../../src/main/resources/static/svelte", "**/*")

  bucket       = aws_s3_bucket.music_bucket.id
  key          = "svelte/${each.value}"
  source       = "${path.module}/../../src/main/resources/static/svelte/${each.value}"
  etag         = filemd5("${path.module}/../../src/main/resources/static/svelte/${each.value}")
  content_type = lookup(local.mime_types, regex("[^.]+$", each.value), "application/octet-stream")
}

resource "aws_s3_object" "frontend_root_index" {
  count        = fileexists("${path.module}/../../src/main/resources/static/svelte/index.html") ? 1 : 0
  bucket       = aws_s3_bucket.music_bucket.id
  key          = "index.html"
  source       = "${path.module}/../../src/main/resources/static/svelte/index.html"
  etag         = filemd5("${path.module}/../../src/main/resources/static/svelte/index.html")
  content_type = "text/html; charset=utf-8"
}

resource "aws_s3_object" "frontend_root_assets" {
  for_each = fileset("${path.module}/../../src/main/resources/static", "*.*")

  bucket       = aws_s3_bucket.music_bucket.id
  key          = each.value
  source       = "${path.module}/../../src/main/resources/static/${each.value}"
  etag         = filemd5("${path.module}/../../src/main/resources/static/${each.value}")
  content_type = lookup(local.mime_types, regex("[^.]+$", each.value), "application/octet-stream")
}
