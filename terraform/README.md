# wyyyyy-dl AWS Terraform 基础设施即代码 (IaC)

> 💡 **项目定位**：  
> 本项目默认运行方式仍为极简的 **Docker / 本地 SQLite**。  
> 本目录提供针对 AWS 云原生的进阶 Serverless 部署方案。为了满足不同开发者的成本与架构诉求，我们在同个分支下提供了**三套可选风味 (Flavors)**，按需取用：

---

## 三套方案横向对比与选型指引

| 方案 | 目录路径 | 数据库 | 网络架构 | 待机固定月费 | 核心优势 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **方案 A：Supabase 极速版** | [`terraform/serverless-supabase/`](./serverless-supabase/) | **Supabase (PostgreSQL 东京区)** | **纯无 VPC** (直连公网与 Supabase) | **$0.00 / 月** (永久免费额度内) | **物理同在东京 (延迟 1~2ms)**、标准 PostgreSQL、自带 Web Studio、免 NAT 网关 | 偏好标准关系型 SQL、喜欢可视化管理后台、同城超低延迟 |
| **方案 B：DynamoDB 纯血 Serverless (首推 ⭐⭐⭐⭐⭐)** | [`terraform/serverless-dynamodb/`](./serverless-dynamodb/) | **Amazon DynamoDB** (NoSQL) | **纯无 VPC** (Lambda 原生自带免费公网出口) | **$0.00 / 月** (永久免费额度内) | 纯 AWS 原生闭环、零第三方账号依赖、永久免休眠、天然无连接池上限与打爆风险 | **最推荐！真正的纯血 Serverless，零维护、开箱即用、永久 $0 待机** |
| **方案 C：土豪重装版** | [`terraform/vpc-rds/`](./vpc-rds/) | **Amazon RDS PostgreSQL** (SQL) | **VPC 私有子网 + NAT Gateway** | **约 $45 ~ $60 / 月** (NAT $32 + RDS $13) | 独享 RDS 实例、全私网隔离、经典云架构全家桶 | 不差钱的架构强迫症、手头已有现成闲置 RDS/VPC 资源顺带复用 (非必要勿建 😂) |

---

## 目录结构说明

```
terraform/
├── README.md                     # 本文档 (三套方案全景对比)
│
├── serverless-supabase/          # 🌟 方案 A：Supabase 东京同城版 ($0/月，SQL 推荐)
│   ├── versions.tf               # AWS Provider (Region: ap-northeast-1 东京)
│   ├── variables.tf
│   ├── s3.tf                     # S3 音频桶 (带 CloudFront OAC 鉴权)
│   ├── lambda.tf                 # Lambda (Java 21 + SnapStart，无 VPC 直连公网与 Supabase)
│   ├── api_gateway.tf            # HTTP API v2 路由
│   ├── cloudfront.tf             # CDN 边缘加速 (/media/* 缓存，API 动态透传)
│   ├── outputs.tf                # 输出 CloudFront URL 与 Uptime Kuma 监控目标
│   └── terraform.tfvars          # 👈 在此填写 Supabase 密码即可
│
├── serverless-dynamodb/          # 🏆 方案 B：DynamoDB 极致省钱版 ($0/月，首推 ⭐⭐⭐⭐⭐)
│   ├── dynamodb.tf               # 3 张按需随量 DynamoDB 表 (PAY_PER_REQUEST)
│   ├── s3.tf / lambda.tf / api_gateway.tf / cloudfront.tf
│   └── terraform.tfvars.example
│
└── vpc-rds/                      # 💸 方案 C：土豪重装版 (VPC + RDS，约 $50/月)
    ├── vpc.tf / rds.tf / s3.tf / lambda.tf / api_gateway.tf / cloudfront.tf
    └── terraform.tfvars.example
```

---

## 快速上手指引

详细实战教程请参考根目录：[DEPLOY_AWS_SNAPSTART.md](../DEPLOY_AWS_SNAPSTART.md)。

### 🏆 快速上手方案 B (DynamoDB 纯血版，首推)

无需配置任何外部数据库账号与密码，全 AWS 原生闭环，开箱即用：

```bash
# 1. 根目录统一打包 Lambda
./gradlew buildAwsZip

# 2. 进入 DynamoDB 方案目录
cd terraform/serverless-dynamodb

# 3. 执行自动化部署 (无需填密码，自动建表与配置 IAM 权限)
terraform init
terraform apply
```

### 🌟 快速上手方案 A (Supabase 东京版)

适合需要标准关系型 SQL 与 Supabase Studio 可视化界面的用户：

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
