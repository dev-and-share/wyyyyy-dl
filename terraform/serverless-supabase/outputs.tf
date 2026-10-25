output "cloudfront_url" {
  description = "CloudFront CDN 统一入口域名 (所有请求访问此地址)"
  value       = "https://${aws_cloudfront_distribution.cdn.domain_name}"
}

output "api_gateway_url" {
  description = "底层 API Gateway 原始端点 URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "s3_bucket_name" {
  description = "S3 音频存储桶名称"
  value       = aws_s3_bucket.music_bucket.id
}

output "supabase_host" {
  description = "绑定的 Supabase Host"
  value       = var.supabase_db_host
}

output "auth_protection" {
  description = "CloudFront 边缘访问保护状态"
  value       = nonsensitive(var.auth_password != "") ? "Enabled (Username: ${var.auth_username})" : "Disabled (Public)"
}

output "quick_test_command" {
  description = "一键测试 API 连通性命令"
  value       = nonsensitive(var.auth_password != "") ? "curl -u ${var.auth_username}:**** -I https://${aws_cloudfront_distribution.cdn.domain_name}/v3/history/list" : "curl -I https://${aws_cloudfront_distribution.cdn.domain_name}/v3/history/list"
}

output "uptime_kuma_monitor_target" {
  description = "建议在 Uptime Kuma 中配置的健康监控 URL (防 Supabase 7天休眠)"
  value       = "https://${aws_cloudfront_distribution.cdn.domain_name}/v3/history/list"
}
