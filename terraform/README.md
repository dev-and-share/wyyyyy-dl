# wyyyyy-dl AWS Terraform 基础设施即代码 (IaC)

> 💡 **项目定位**：  
> 本项目默认运行方式仍为极简的 **Docker / 本地 SQLite**。  
> 本目录提供针对 AWS 云原生的进阶 Serverless 部署方案。为了满足不同开发者的成本与架构诉求，我们在同个分支下提供了**两种可选风味 (Flavors)**，按需取用：

---

## 两种方案横向对比与选型指引

| 方案 | 目录路径 | 数据库 | 网络架构 | 待机固定月费 | 核心优势 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **方案 1：极致省钱版 (推荐)** | [`terraform/serverless-dynamodb/`](./serverless-dynamodb/) | **Amazon DynamoDB** (NoSQL) | **纯无 VPC** (Lambda 原生自带免费公网出口) | **$0.00 / 月** (永久免费额度内) | 0 网络底噪费、免 NAT 网关、天然无连接池上限、零打爆风险 | 个人学习、低频/个人离线音乐库、预算敏感 |
| **方案 2：企业内网版** | [`terraform/vpc-rds/`](./vpc-rds/) | **Amazon RDS PostgreSQL** (SQL) | **VPC 私有子网 + NAT Gateway** (带免费 S3 Gateway Endpoint) | **约 $45 ~ $60 / 月** (NAT $32 + RDS $13) | 标准关系型 SQL、支持复杂联表与外部数据库集成、内置预留并发防打爆 | 企业内网安全隔离、已有关系型数据库基础设施 |

---

## 目录结构说明

```
terraform/
├── README.md                     # 本文档 (两套方案全景对比)
│
├── serverless-dynamodb/          # 🌟 方案 1：极致省钱版 ($0/月)
│   ├── versions.tf
│   ├── variables.tf
│   ├── dynamodb.tf               # 3 张按需随量 DynamoDB 表 (PAY_PER_REQUEST)
│   ├── s3.tf                     # S3 音频持久化桶 + CloudFront OAC 鉴权
│   ├── lambda.tf                 # Lambda (Java 21 + SnapStart，无 VPC 原生上网)
│   ├── api_gateway.tf            # HTTP API v2 路由
│   ├── cloudfront.tf             # CDN 边缘加速 (/media/* 缓存，API 动态透传)
│   ├── outputs.tf
│   └── terraform.tfvars.example
│
└── vpc-rds/                      # 🏢 方案 2：企业内网版 (VPC + RDS)
    ├── versions.tf
    ├── variables.tf
    ├── vpc.tf                    # VPC、双 AZ 公私子网、NAT Gateway、免费 S3 Gateway Endpoint
    ├── rds.tf                    # RDS PostgreSQL (静态加密、无公网暴露、自动备份)
    ├── s3.tf                     # S3 音乐桶
    ├── lambda.tf                 # Lambda (置于 VPC 私网，带预留并发防打爆)
    ├── api_gateway.tf
    ├── cloudfront.tf
    ├── outputs.tf
    └── terraform.tfvars.example
```

---

## 快速上手

详细实战教程请参考根目录：[DEPLOY_AWS_SNAPSTART.md](../DEPLOY_AWS_SNAPSTART.md)。

### 选项 A：部署方案 1（极力推荐：$0 待机月费）
```bash
# 1. 打包
./gradlew buildAwsZip

# 2. 进入 DynamoDB 目录一键部署
cd terraform/serverless-dynamodb
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

### 选项 B：部署方案 2（VPC + RDS PostgreSQL）
```bash
# 1. 打包
./gradlew buildAwsZip

# 2. 进入 VPC-RDS 目录一键部署
cd terraform/vpc-rds
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

---

## 资源销毁与回收

不再使用时，进入对应目录执行：
```bash
terraform destroy
```
即可将云端所有关联资源全部安全回收。
