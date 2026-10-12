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
  description = "环境标识 (prod, stage, dev)"
  type        = string
  default     = "prod"
}

# ==========================================
# Lambda 相关配置
# ==========================================
variable "lambda_memory_size" {
  description = "Lambda 函数内存分配 (MB)。Spring Boot 3 + SnapStart 建议 1536MB ~ 2048MB 以保障启动 CPU 算力"
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

variable "lambda_reserved_concurrency" {
  description = "Lambda 最大预留并发上限 (免费防打爆 RDS 机制，0 为不限制)"
  type        = number
  default     = 20
}

# ==========================================
# RDS 状态数据库配置
# ==========================================
variable "enable_rds" {
  description = "是否启用 RDS PostgreSQL 持久化状态与历史记录。设为 false 时将使用临时存储"
  type        = bool
  default     = true
}

variable "rds_instance_class" {
  description = "RDS 实例规格 (推荐使用 Graviton db.t4g.micro 兼顾成本与性能)"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  description = "RDS 磁盘分配空间 (GB)"
  type        = number
  default     = 20
}

variable "rds_db_name" {
  description = "数据库名称"
  type        = string
  default     = "musicdb"
}

variable "rds_username" {
  description = "RDS 管理员账号"
  type        = string
  default     = "dbadmin"
}

variable "rds_password" {
  description = "RDS 管理员密码 (生产环境建议通过 tfvars 传入或 Secrets Manager 管理)"
  type        = string
  default     = "WyyyyyDlSecurePass2026!"
  sensitive   = true
}

# ==========================================
# CloudFront CDN 配置
# ==========================================
variable "cloudfront_price_class" {
  description = "CloudFront 定价层级。PriceClass_100: 仅北美与欧洲 (最经济); PriceClass_All: 全球所有边缘节点"
  type        = string
  default     = "PriceClass_100"
}
