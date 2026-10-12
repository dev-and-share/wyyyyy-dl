output "cloudfront_url" {
  description = "CloudFront CDN 统一入口域名 (推荐所有 API 和音频流请求均访问此地址)"
  value       = "https://${aws_cloudfront_distribution.cdn.domain_name}"
}

output "api_gateway_url" {
  description = "底层 API Gateway 原始端点 URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "s3_bucket_name" {
  description = "S3 音频与歌词持久化存储桶名称"
  value       = aws_s3_bucket.music_bucket.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL 数据库连接端点 (仅在 enable_rds=true 时存在)"
  value       = var.enable_rds ? aws_db_instance.postgres[0].endpoint : "RDS Disabled"
}

output "lambda_function_name" {
  description = "Lambda 函数名称"
  value       = aws_lambda_function.spring_app.function_name
}

output "lambda_alias_arn" {
  description = "生产环境 SnapStart 别名 ARN (调用必须以此别名或具体版本进行，切忌裸调 $LATEST)"
  value       = aws_lambda_alias.prod_alias.arn
}

output "quick_test_command" {
  description = "一键测试 API 端点连通性命令"
  value       = "curl -I https://${aws_cloudfront_distribution.cdn.domain_name}/v3/history/list"
}
