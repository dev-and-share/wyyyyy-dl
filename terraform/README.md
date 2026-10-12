# wyyyyy-dl AWS Terraform 基础设施即代码 (IaC)

> 💡 **注意**：本项目默认采用轻量级的 **Docker / 本地 SQLite** 运行方式。  
> 本目录为**进阶云原生选配方案**，面向希望在 **AWS Serverless (Lambda SnapStart + S3 + RDS + CloudFront)** 体系下以按需计费、0 服务器常驻成本运行本系统的开发者。

---

## 架构拓扑

```
[ 客户端浏览器 / 移动端 ]
            │
            ▼
   AWS CloudFront (CDN)
   ├── 动态接口 /* (透传)  ────────► API Gateway HTTP API v2
   │                                        │
   │                                        ▼
   │                              Lambda Alias (prod)
   │                              [Spring Boot 3 + SnapStart]
   │                                   (VPC 私有子网)
   │                                    │           │
   │                           (NAT)    ▼           ▼
   │                        外网 API 访问     RDS PostgreSQL
   │
   └── 静态音频 /media/* (缓存加速) ──► AWS S3 私有音频桶 (OAC 鉴权)
```

---

## 模块清单

| 文件 | 资源说明 | 安全与架构亮点 |
| :--- | :--- | :--- |
| `versions.tf` | Terraform & AWS Provider 声明 | 统一全局 `default_tags` (Project, Environment, ManagedBy) |
| `variables.tf` | 部署参数与变量定义 | 支持规格配置与 `enable_rds` 灵活开关 |
| `vpc.tf` | VPC、双 AZ 公私子网、NAT Gateway、安全组 | Lambda 置于私网，严格限制安全组互通 |
| `lambda.tf` | AWS Lambda (Java 21 + SnapStart) | 启用 `publish = true`、SnapStart 快照、绑定 `prod` 别名 |
| `api_gateway.tf` | HTTP API v2 与路由集成 | 精确授权调用 Lambda Alias，开启 CloudWatch 访问审计日志 |
| `s3.tf` | 音乐与歌词持久化存储桶 | 彻底阻断公网访问，启用 SSE-S3 加密、版本控制与 CloudFront OAC |
| `cloudfront.tf` | CDN 边缘分发与行为路由 | 音频 Range 缓存优化、S3 内部回源免流量费、HTTP/2&3 支持 |
| `rds.tf` | RDS PostgreSQL 数据库 (可选) | 开启静态加密 (`storage_encrypted`)、无公网 IP、自动备份 |
| `outputs.tf` | 部署后关键端点输出 | 统一 CloudFront 访问地址与快速验证命令 |

---

## 安全设计习惯

本模块参考了生产级安全加固实践：
1. **网络隔离**：数据库与 Lambda 均部署在私有子网（Private Subnet），不暴露任何公网 IP。
2. **数据加密**：S3 启用默认 `AES256` 服务端加密，RDS 启用 `storage_encrypted = true`。
3. **访问收敛**：S3 桶使用 **Origin Access Control (OAC)** 搭配条件策略限制仅指定 CloudFront 分发可读；API Gateway 仅授权调用具体的 Lambda 别名。
4. **日志治理**：所有 CloudWatch 日志组均显式声明并设置 `retention_in_days = 7`，避免存储无上限计费。
5. **统一打 Tag**：所有资源均打上 `Project`、`Environment`、`Component` 与 `ManagedBy` 标签。

---

## 快速部署流程

详细的手把手端到端实战请查阅根目录：[DEPLOY_AWS_SNAPSTART.md](../DEPLOY_AWS_SNAPSTART.md)。

简明命令速查：

```bash
# 1. 回到项目根目录打包 Lambda ZIP
cd ..
./gradlew buildAwsZip

# 2. 进入 terraform 目录初始化
cd terraform
cp terraform.tfvars.example terraform.tfvars
# 根据需要编辑 terraform.tfvars 中的数据库密码与区域

# 3. 初始化并查看执行计划
terraform init
terraform plan

# 4. 执行部署 (创建 VPC、RDS、S3、Lambda SnapStart 与 CloudFront)
terraform apply

# 5. 查看输出并在完成后测试
terraform output cloudfront_url
```

---

## 资源销毁与回收

不再使用时，可一键清理所有 AWS 云端资源以避免扣费：

```bash
terraform destroy
```
