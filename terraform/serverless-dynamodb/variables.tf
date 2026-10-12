variable "aws_region" {
  description = "AWS 部署区域"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "项目名称标识"
  type        = string
  default     = "wyyyyy-dl"
}

variable "environment" {
  description = "环境标识 (prod, dev)"
  type        = string
  default     = "prod"
}

variable "lambda_memory_size" {
  description = "Lambda 函数内存分配 (MB)。Spring Boot 3 + SnapStart 建议 1536MB ~ 2048MB"
  type        = number
  default     = 2048
}

variable "lambda_timeout" {
  description = "Lambda 函数超时时间 (秒)"
  type        = number
  default     = 30
}

variable "lambda_zip_path" {
  description = "编译打包产物 ZIP 文件的相对路径"
  type        = string
  default     = "../../build/distributions/wyyyyy-dl-aws.zip"
}

variable "cloudfront_price_class" {
  description = "CloudFront 定价层级 (PriceClass_100: 美欧边缘节点，最经济)"
  type        = string
  default     = "PriceClass_100"
}
