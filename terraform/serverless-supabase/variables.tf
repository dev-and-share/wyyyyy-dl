variable "aws_region" {
  description = "AWS 部署区域 (东京区为 ap-northeast-1)"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "项目名称标识"
  type        = string
  default     = "wyyyyy-dl"
}

variable "environment" {
  description = "环境标识"
  type        = string
  default     = "prod"
}

# ==========================================
# Supabase PostgreSQL 配置
# ==========================================
variable "supabase_db_host" {
  description = "Supabase 数据库主机 Host"
  type        = string
  default     = "db.iqnggtdrcgxuyvblbjbw.supabase.co"
}

variable "supabase_db_port" {
  description = "Supabase 端口 (直连 5432, Transaction Pooler 6543)"
  type        = number
  default     = 5432
}

variable "supabase_db_name" {
  description = "数据库名称"
  type        = string
  default     = "postgres"
}

variable "supabase_db_user" {
  description = "数据库用户名"
  type        = string
  default     = "postgres"
}

variable "supabase_db_password" {
  description = "Supabase 数据库密码"
  type        = string
  sensitive   = true
}

# ==========================================
# Lambda 配置
# ==========================================
variable "lambda_memory_size" {
  description = "Lambda 函数内存分配 (MB)"
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
  description = "CloudFront 定价层级 (PriceClass_All 覆盖全球与日本)"
  type        = string
  default     = "PriceClass_All"
}

variable "netease_cookie" {
  description = "网易云音乐 Cookie (可选，优先从本地文件或此变量注入)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "auth_username" {
  description = "CloudFront 边缘访问控制用户名 (默认 admin)"
  type        = string
  default     = "admin"
}

variable "auth_password" {
  description = "CloudFront 边缘访问控制密码 (留空则不开启鉴权)"
  type        = string
  default     = ""
  sensitive   = true
}
