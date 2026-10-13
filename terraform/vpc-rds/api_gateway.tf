# ==========================================
# API Gateway (HTTP API v2)
# ==========================================

# CloudWatch 日志组（用于记录 API Gateway 访问日志，符合生产安全审计标准）
resource "aws_cloudwatch_log_group" "api_gw_logs" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-apigw-logs"
  }
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
  description   = "Serverless HTTP API Gateway routing to Spring Boot Lambda SnapStart alias"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With", "Range"]
    max_age       = 86400
  }

  tags = {
    Name = "${var.project_name}-http-api"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_logs.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      requestTime        = "$context.requestTime"
      httpMethod         = "$context.httpMethod"
      routeKey           = "$context.routeKey"
      status             = "$context.status"
      protocol           = "$context.protocol"
      responseLength     = "$context.responseLength"
      latency            = "$context.responseLatency"
      integrationLatency = "$context.integration.latency"
    })
  }

  tags = {
    Name = "${var.project_name}-api-stage-default"
  }
}

# 核心：Integration 必须绑定别名的 invoke_arn，绝对不能绑定裸函数的 arn
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_alias.prod_alias.invoke_arn
  payload_format_version = "1.0"
  description            = "Proxy integration to SnapStart published alias"
}

resource "aws_apigatewayv2_route" "catch_all" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# 授权 API Gateway 调用 Lambda 的 prod 别名 (精确收敛 source_arn 与 qualifier)
resource "aws_lambda_permission" "apigw_invoke_permission" {
  statement_id  = "AllowAPIGatewayInvokeProdAlias"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.spring_app.function_name
  principal     = "apigateway.amazonaws.com"
  qualifier     = aws_lambda_alias.prod_alias.name
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
