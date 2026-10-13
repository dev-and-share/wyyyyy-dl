# ==========================================
# API Gateway (HTTP API v2)
# ==========================================

resource "aws_cloudwatch_log_group" "api_gw_logs" {
  name              = "/aws/apigateway/${var.project_name}-ddb-${var.environment}"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-apigw-ddb-logs"
  }
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api-ddb-${var.environment}"
  protocol_type = "HTTP"
  description   = "Serverless HTTP API Gateway routing to DynamoDB-backed SnapStart Lambda"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"]
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With", "Range"]
    max_age       = 86400
  }

  tags = {
    Name = "${var.project_name}-http-api-ddb"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      latency        = "$context.responseLatency"
      integrationLatency = "$context.integration.latency"
    })
  }

  tags = {
    Name = "${var.project_name}-api-stage-default"
  }
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_alias.prod_alias.invoke_arn
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "catch_all" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "apigw_invoke_permission" {
  statement_id  = "AllowAPIGatewayInvokeDdbProdAlias"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.spring_app.function_name
  principal     = "apigateway.amazonaws.com"
  qualifier     = aws_lambda_alias.prod_alias.name
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
