# ==========================================
# RDS 状态数据库 (PostgreSQL)
# ==========================================
resource "aws_db_subnet_group" "main" {
  count      = var.enable_rds ? 1 : 0
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  count                  = var.enable_rds ? 1 : 0
  identifier             = "${var.project_name}-postgres-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = var.rds_instance_class
  allocated_storage      = var.rds_allocated_storage
  max_allocated_storage  = 100
  storage_type           = "gp3"
  db_name                = var.rds_db_name
  username               = var.rds_username
  password               = var.rds_password
  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  skip_final_snapshot    = true
  deletion_protection    = false
  publicly_accessible    = false

  # 安全最佳实践：启用静态数据加密与自动化日常备份
  storage_encrypted          = true
  backup_retention_period    = 7
  auto_minor_version_upgrade = true

  tags = {
    Name      = "${var.project_name}-postgres-db"
    Component = "Database"
  }
}
