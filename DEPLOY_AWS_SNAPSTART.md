# AWS Lambda SnapStart Serverless 部署操作指南

> 📖 **方案概述**：  
> 本指南支持将 `wyyyyy-dl` 部署为全托管 AWS 云原生应用。  
> 我们在同个代码库中提供了**三套开箱即用的部署方案**，代码已完成三模自适应（本地 SQLite / RDS PostgreSQL / DynamoDB），按需挑选即可：
> - 🏆 **方案 A：DynamoDB 纯血版 (首推 ⭐⭐⭐⭐⭐)** — `AWS Lambda SnapStart + S3 + CloudFront + DynamoDB`（全 AWS 原生无状态，零第三方依赖，永久免休眠，$0.00 / 月）
> - 🌟 **方案 B：Supabase 极速版** — `AWS 东京 Lambda SnapStart + S3 + CloudFront + Supabase (东京区)`（**物理同在东京，延迟仅 1~2ms，待机月费 $0.00**，免 VPC、免 NAT 网关，标准 SQL）
> - 💸 **方案 C：土豪重装版** — `AWS Lambda SnapStart + S3 + CloudFront + VPC + RDS PostgreSQL`（独享 RDS 与私网全家桶，待机约 $45~$60/月，非必要勿建 😂）

---

## 一、 为什么推荐 Serverless 方案？

1. **方案 A (DynamoDB 首推)**：
   - **全 AWS 原生闭环**：无需额外注册第三方平台账号，IAM 角色免密鉴权。
   - **永久免休眠**：天然 $0 月租，即便几个月无流量也不会冻结，零心智维护负担。
   - **天然无连接池上限**：基于 HTTP API 与 AWS 原生集成，永远无并发打爆数据库风险。
2. **方案 B (Supabase 东京版)**：
   - **物理同城超低延迟**：AWS 东京机房直连 Supabase 东京机房，延迟仅 1~2ms。
   - **标准 PostgreSQL**：自带 Web Studio 可视化数据后台，支持标准 SQL 查询。
   - **免 VPC 账单包袱**：省去 NAT 网关与 RDS 费用，配合 Uptime Kuma 即可保持活跃。

---

## 二、 部署前准备

1. **JDK 21**：运行 `./gradlew -v`。
2. **Terraform CLI (>= 1.5.0)**：运行 `terraform -version`。
3. **AWS CLI**：运行 `aws sts get-caller-identity`。
4. **Supabase 数据库准备**：
   - 已获取到你的 Host：`db.iqnggtdrcgxuyvblbjbw.supabase.co`
   - 已记住你的数据库密码。

---

## 三、 第一步：统一打包 Serverless 产物

无论采用哪种方案，编译与打包只需在项目根目录下执行一次：

```bash
cd /Users/houtokki/Downloads/fast_sr/wyyyyy-dl

# 执行打包任务 (生成包含 Java 21 class 与所有第三方依赖的标准 Zip)
./gradlew buildAwsZip
```

生成的部署包位置：`build/distributions/wyyyyy-dl-aws.zip` (~56MB)。

---

## 四、 第二步：部署方案 B (Supabase 东京版)

进入专属目录并配置密码：

```bash
cd terraform/serverless-supabase
```

打开 `terraform.tfvars`，将你的 Supabase 数据库密码填入：
```hcl
aws_region   = "ap-northeast-1"
project_name = "wyyyyy-dl"
environment  = "prod"

# Supabase 连接信息 (已自动为你预填)
supabase_db_host     = "db.iqnggtdrcgxuyvblbjbw.supabase.co"
supabase_db_port     = 5432
supabase_db_name     = "postgres"
supabase_db_user     = "postgres"
supabase_db_password = "这里替换为你设置的密码" # 👈 填入你的真实密码
```

执行部署：
```bash
# 1. 初始化
terraform init

# 2. 预览资源计划
terraform plan

# 3. 开始执行自动化部署
terraform apply
```
> 输入 `yes` 确认。耗时约 2~3 分钟（AWS 后台自动执行 SnapStart 内存快照拍摄与 CloudFront 全球分发）。

---

## 五、 第三步：验证与测试

部署成功后，终端将输出：
```text
Outputs:
cloudfront_url = "https://d123456abcdef.cloudfront.net"
quick_test_command = "curl -I https://d123456abcdef.cloudfront.net/v3/history/list"
uptime_kuma_monitor_target = "https://d123456abcdef.cloudfront.net/v3/history/list"
```

### 1. 执行全量一键端到端冒烟巡检 (强烈推荐 ⭐⭐⭐⭐⭐)
```bash
export CDN_URL=$(terraform output -raw cloudfront_url)

# 一键运行核心 API 自动化冒烟巡检 (默认【绝对零写入纯读模式】，绝不污染真实数据库与真实 Cookie)
bash ../../scripts/smoke_test.sh "${CDN_URL}"

# (可选) 若需要测试写入并自动回滚清理：
# bash ../../scripts/smoke_test.sh "${CDN_URL}" --include-write
```
> 若全部输出 `✅ PASS`，说明该架构下的后端与前端核心 API 链路均处于 100% 生产就绪状态！

### 2. 验证冷启动与接口连通
```bash
# 单独测试历史记录接口
curl -i "${CDN_URL}/v3/history/list"
```
> 首次调用触发 SnapStart 快照恢复，查看 CloudWatch 日志即可看到 **Restore Duration 仅需 ~300ms**！  
> 并且 Spring Boot 首次启动已在 Supabase 中**全自动建好 `download_history` 等全部数据表**，你无需手动执行任何 SQL！

### 2. 验证歌曲下载与 S3 / CloudFront 播放
```bash
# 解析并下载单曲
curl -X GET "${CDN_URL}/v3/download/single?id=186016"

# 请求音频播放流 (自动 302 重定向至 CloudFront CDN 边缘缓存播放，不消耗 Lambda 时长)
curl -I "${CDN_URL}/v3/history/stream?path=186016.mp3"
```

---

## 六、 配置 Uptime Kuma 防冻结保活

打开你的 **Uptime Kuma** 控制台，添加一个新监控项：
- **Monitor Type**：`HTTP(s)`
- **Friendly Name**：`wyyyyy-dl-supabase-keepalive`
- **URL**：填入部署输出的 `https://${CDN_URL}/v3/history/list`
- **Heartbeat Interval**：`43200` 秒（即每 12 小时 ping 一次）或每天一次。

> 🛡️ **双重收益**：  
> 1. 随时掌握你的音乐下载服务健康状态；  
> 2. 定期访问后端会自动触发 Supabase 查询，**彻底打破“连续 7 天无流量项目被冻结”的限制，实现终身免维护常驻！**

---

---

## 六、 部署方案 A (DynamoDB 纯血版)

如果你不想注册 Supabase，追求纯 AWS 闭环与永久免休眠（$0 月租）：

```bash
cd terraform/serverless-dynamodb

# 1. 初始化
terraform init

# 2. 部署（零外部参数，全自动配置）
terraform apply
```

---

## 七、 三个方案的命名、标签与销毁隔离规范

为了保证方案 A、B、C **可以同时共存测试，也可以随时单独安全销毁（Destroy）**，我们已在 Terraform 中实施了完整的隔离规范：

| 方案 | S3 媒体桶命名 | Lambda 函数名 | 隔离标签 (Flavor) | 一键单独销毁命令 |
|---|---|---|---|---|
| **A: DynamoDB** | `wyyyyy-dl-music-ddb-*` | `wyyyyy-dl-backend-ddb-*` | `Flavor = "dynamodb"` | `cd terraform/serverless-dynamodb && terraform destroy` |
| **B: Supabase** | `wyyyyy-dl-music-supa-*` | `wyyyyy-dl-backend-supa-*` | `Flavor = "supabase"` | `cd terraform/serverless-supabase && terraform destroy` |
| **C: VPC-RDS** | `wyyyyy-dl-music-rds-*` | `wyyyyy-dl-backend-rds-*` | `Flavor = "vpc-rds"` | `cd terraform/vpc-rds && terraform destroy` |

> 💡 **S3 干净销毁保障**：  
> 所有 3 个方案的 S3 存储桶均已配置 `force_destroy = true`。执行单独 `terraform destroy` 时，会自动连同上传的 Lambda 部署包及测试媒体文件彻底删除，**绝不会因为 Bucket 非空而报错阻塞销毁流程**！

---

## 八、 日常更新部署

无论使用哪个方案，更新业务代码只需两步：
```bash
# 1. 重新打包
./gradlew buildAwsZip

# 2. 重新应用对应方案
cd terraform/serverless-dynamodb && terraform apply   # 若为 DynamoDB
# 或 cd terraform/serverless-supabase && terraform apply # 若为 Supabase
```
