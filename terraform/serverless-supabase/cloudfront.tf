# ==========================================
# CloudFront CDN 统一分发 (API + S3 音频媒体)
# ==========================================

locals {
  s3_origin_id    = "S3-${aws_s3_bucket.music_bucket.id}"
  apigw_origin_id = "APIGW-${aws_apigatewayv2_api.http_api.id}"
}

resource "aws_cloudfront_cache_policy" "media_cache_policy" {
  name        = "${var.project_name}-media-supa-policy-${var.environment}"
  comment     = "Optimized cache policy for audio media streaming with Range support"
  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Range", "Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      }
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = false
    enable_accept_encoding_brotli = false
  }
}

# ------------------------------------------
# 边缘 HTTP Basic Auth 安全防护函数 (0 待机费，边缘拦截)
# ------------------------------------------
resource "aws_cloudfront_function" "basic_auth" {
  count   = var.auth_password != "" ? 1 : 0
  name    = "${var.project_name}-basic-auth-supa-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Edge HTTP Basic Auth for Wyyyyy-DL security"
  publish = true
  code    = <<-EOT
    function handler(event) {
        var request = event.request;
        var headers = request.headers;

        var expectedAuth = "Basic ${base64encode("${var.auth_username}:${var.auth_password}")}";

        if (headers.authorization && headers.authorization.value === expectedAuth) {
            return request;
        }

        return {
            statusCode: 401,
            statusDescription: "Unauthorized",
            headers: {
                "www-authenticate": { value: 'Basic realm="Wyyyyy-DL Private Cloud", charset="UTF-8"' },
                "content-type": { value: "text/plain; charset=utf-8" }
            },
            body: "401 Unauthorized: Access Denied. Please provide valid credentials."
        };
    }
  EOT
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront Distribution for ${var.project_name} Supabase Flavor"
  price_class         = var.cloudfront_price_class
  http_version        = "http2and3"
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.music_bucket.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  origin {
    domain_name = replace(aws_apigatewayv2_api.http_api.api_endpoint, "https://", "")
    origin_id   = local.apigw_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ------------------------------------------
  # 默认行为：S3 静态前端直出 (全球 CDN 边缘极速缓存，0 报错，0 Lambda 消耗)
  # ------------------------------------------
  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized

    dynamic "function_association" {
      for_each = var.auth_password != "" ? [aws_cloudfront_function.basic_auth[0].arn] : []
      content {
        event_type   = "viewer-request"
        function_arn = function_association.value
      }
    }
  }

  # ------------------------------------------
  # 业务 API 动态路由 (/v3/* -> API Gateway -> Spring Boot Lambda)
  # ------------------------------------------
  ordered_cache_behavior {
    path_pattern           = "/v3/*"
    target_origin_id       = local.apigw_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader

    dynamic "function_association" {
      for_each = var.auth_password != "" ? [aws_cloudfront_function.basic_auth[0].arn] : []
      content {
        event_type   = "viewer-request"
        function_arn = function_association.value
      }
    }
  }

  # ------------------------------------------
  # 音频媒体路由 (/media/* -> S3 音频存储，支持 HTTP Range 流式播放)
  # ------------------------------------------
  ordered_cache_behavior {
    path_pattern           = "/media/*"
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id = aws_cloudfront_cache_policy.media_cache_policy.id

    dynamic "function_association" {
      for_each = var.auth_password != "" ? [aws_cloudfront_function.basic_auth[0].arn] : []
      content {
        event_type   = "viewer-request"
        function_arn = function_association.value
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name = "${var.project_name}-cdn-supa"
  }
}
