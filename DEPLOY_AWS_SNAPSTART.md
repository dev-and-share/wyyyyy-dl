# AWS Lambda SnapStart Serverless 部署操作指南

> 📖 **方案概述**：  
> 本指南支持将 `wyyyyy-dl` 部署为全托管 AWS 云原生应用。  
> 我们在同个代码库中提供了**三套开箱即用的部署方案**，代码已完成三模自适应（本地 SQLite / RDS PostgreSQL / DynamoDB），按需挑选即可：
> - 🌟 **方案 A：Supabase 极速版** — `AWS 东京 Lambda SnapStart + S3 + CloudFront + Supabase (东京区)`（**物理同在东京，延迟仅 1~2ms，待机月费 $0.00**，免 VPC、免 NAT 网关，标准 SQL）
> - 🏆 **方案 B：DynamoDB 纯血版 (首推 ⭐⭐⭐⭐⭐)** — `AWS Lambda SnapStart + S3 + CloudFront + DynamoDB`（全 AWS 原生无状态，零第三方依赖，永久免休眠，$0.00 / 月）
> - 💸 **方案 C：土豪重装版** — `AWS Lambda SnapStart + S3 + CloudFront + VPC + RDS PostgreSQL`（独享 RDS 与私网全家桶，待机约 $45~$60/月，非必要勿建 😂）

---

## 一、 为什么首推方案 A (Supabase 东京版)？

1. **同城同机房极速互联**：
   - AWS Lambda 部署在东京（`ap-northeast-1`），Supabase 项目也选择东京（`ap-northeast-1`），物理同城，网络延迟低至 **1 ~ 2 毫秒**！
2. **纯正标准 PostgreSQL**：
   - 原生支持标准 SQL 查询、多字段模糊检索与分页，**无需对代码做任何 NoSQL 改动**。
3. **彻底甩开 VPC 账单包袱**：
   - 因为 Supabase 是公网托管数据库，Lambda **彻底不需要配置任何 VPC**！
   - **直接省下 $32/月的 NAT Gateway，直接省下 $13/月的 RDS**，待机固定月费真正等于 **$0.00**！
4. **配合 Uptime Kuma 破除 7 天休眠**：
   - 使用你的 Uptime Kuma 每 1~2 天对 CloudFront 健康检查地址发起一次心跳监控，既守护应用状态，又顺带让 Supabase 永远不会进入休眠！

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

## 四、 第二步：一键部署方案 A (Supabase 东京版)

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

### 1. 验证冷启动与接口连通
```bash
export CDN_URL=$(terraform output -raw cloudfront_url)

# 发送请求测试历史记录接口
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

## 七、 日常更新部署与资源销毁

### 日常更新业务代码：
```bash
./gradlew buildAwsZip
cd terraform/serverless-supabase && terraform apply
```

### 不用时一键销毁回收：
```bash
cd terraform/serverless-supabase && terraform destroy
```
