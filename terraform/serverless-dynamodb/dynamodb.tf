# ==========================================
# DynamoDB 无状态存储 (按需随量计费，永久免费额度内)
# ==========================================

# 1. 下载历史记录表
resource "aws_dynamodb_table" "music_history" {
  name         = "${var.project_name}-ddb-history-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "N"
  }

  attribute {
    name = "song_id"
    type = "N"
  }

  global_secondary_index {
    name            = "song_id-index"
    hash_key        = "song_id"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = false # 个人/测试环境可关闭节省极微量快照费
  }

  tags = {
    Name        = "${var.project_name}-dynamodb-history"
    Component   = "Database"
    Environment = var.environment
    Flavor      = "dynamodb"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

# 2. 红心单曲表
resource "aws_dynamodb_table" "music_likes" {
  name         = "${var.project_name}-ddb-likes-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "song_id"

  attribute {
    name = "song_id"
    type = "N"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${var.project_name}-dynamodb-likes"
    Component   = "Database"
    Environment = var.environment
    Flavor      = "dynamodb"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

# 3. 原始 Raw JSON 扩展数据表
resource "aws_dynamodb_table" "music_raw_json" {
  name         = "${var.project_name}-ddb-raw-json-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "history_id"

  attribute {
    name = "history_id"
    type = "N"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${var.project_name}-dynamodb-raw-json"
    Component   = "Database"
    Environment = var.environment
    Flavor      = "dynamodb"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}

# 4. 系统配置与网易云 Cookie 持久化表
resource "aws_dynamodb_table" "music_config" {
  name         = "${var.project_name}-ddb-config-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "config_key"

  attribute {
    name = "config_key"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${var.project_name}-dynamodb-config"
    Component   = "Database"
    Environment = var.environment
    Flavor      = "dynamodb"
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }
}
