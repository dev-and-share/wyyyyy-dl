# wyyyyy-dl AWS Terraform 基础设施即代码 (IaC)

> 💡 **项目定位**：  
> 本项目默认运行方式仍为极简的 **Docker / 本地 SQLite**。  
> 本目录提供针对 AWS 云原生的进阶 Serverless 部署方案。为了满足不同开发者的成本与架构诉求，我们在同个分支下提供了**三套可选风味 (Flavors)**，按需取用：

---

## 三套方案横向对比与选型指引

| 方案 | 目录路径 | 数据库 | 网络架构 | 待机固定月费 | 核心优势 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **方案 A：Supabase 极速版 (首推 ⭐⭐⭐⭐⭐)** | [`terraform/serverless-supabase/`](./serverless-supabase/) | **Supabase (PostgreSQL 东京区)** | **纯无 VPC** (直连公网与 Supabase) | **$0.00 / 月** (永久免费额度内) | **物理同在东京 (延迟 1~2ms)**、标准 PostgreSQL、自带连接池、免 NAT 网关 | **最推荐！兼顾标准 SQL、同城超低延迟与 $0 月租** |
| **方案 B：DynamoDB 纯血 Serverless** | [`terraform/serverless-dynamodb/`](./serverless-dynamodb/) | **Amazon DynamoDB** (NoSQL) | **纯无 VPC** (Lambda 原生自带免费公网出口) | **$0.00 / 月** (永久免费额度内) | 0 网络底噪费、免 NAT 网关、天然无连接池上限、零打爆风险 | 全 AWS 原生闭环、NoSQL 极简无状态 |
| **方案 C：企业内网版** | [`terraform/vpc-rds/`](./vpc-rds/) | **Amazon RDS PostgreSQL** (SQL) | **VPC 私有子网 + NAT Gateway** | **约 $45 ~ $60 / 月** (NAT $32 + RDS $13) | 标准企业 VPC 私网隔离、已有 RDS 基础设施 | 企业合规内网需求 |

---

## 目录结构说明

```
terraform/
├── README.md                     # 本文档 (三套方案全景对比)
│
├── serverless-supabase/          # 🌟 方案 A：Supabase 东京同城版 ($0/月，推荐)
│   ├── versions.tf               # AWS Provider (Region: ap-northeast-1 东京)
│   ├── variables.tf
│   ├── s3.tf                     # S3 音频桶 (带 CloudFront OAC 鉴权)
│   ├── lambda.tf                 # Lambda (Java 21 + SnapStart，无 VPC 直连公网与 Supabase)
│   ├── api_gateway.tf            # HTTP API v2 路由
│   ├── cloudfront.tf             # CDN 边缘加速 (/media/* 缓存，API 动态透传)
│   ├── outputs.tf                # 输出 CloudFront URL 与 Uptime Kuma 监控目标
│   └── terraform.tfvars          # 👈 在此填写 Supabase 密码即可
│
├── serverless-dynamodb/          # 🌟 方案 B：DynamoDB 极致省钱版 ($0/月)
│   ├── dynamodb.tf               # 3 张按需随量 DynamoDB 表 (PAY_PER_REQUEST)
│   ├── s3.tf / lambda.tf / api_gateway.tf / cloudfront.tf
│   └── terraform.tfvars.example
│
└── vpc-rds/                      # 🏢 方案 C：企业内网版 (VPC + RDS)
    ├── vpc.tf / rds.tf / s3.tf / lambda.tf / api_gateway.tf / cloudfront.tf
    └── terraform.tfvars.example
```

---

## 快速上手方案 A (Supabase 东京版)

详细实战教程请参考根目录：[DEPLOY_AWS_SNAPSTART.md](../DEPLOY_AWS_SNAPSTART.md)。

```bash
# 1. 根目录统一打包 Lambda
./gradlew buildAwsZip

# 2. 进入 Supabase 方案目录
cd terraform/serverless-supabase

# 3. 编辑 terraform.tfvars (填入你的 Supabase 数据库密码)
# 4. 执行自动化部署
terraform init
terraform apply

# 5. 部署完毕后，复制输出的 uptime_kuma_monitor_target 加入你的 Uptime Kuma
# (每 1~2 天 ping 一次，既监控服务，又彻底防止 Supabase 7天无流量休眠！)
```

---

## 资源销毁与回收

不再使用时，进入对应目录执行：
```bash
terraform destroy
```
即可将云端所有关联资源全部安全回收。
